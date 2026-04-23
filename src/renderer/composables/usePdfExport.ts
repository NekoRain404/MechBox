/**
 * usePdfExport - 统一 PDF 导出组合式函数
 * 消除 13+ 个页面中重复的 jsPDF + html2canvas 导入和逻辑
 */
import { ref } from 'vue'
import { appendStoredReport, type ReportRecord } from '../utils/reporting'
import { resolveLatestWorkflowArtifactLink } from '../utils/workflow-artifacts'

type JsPdfConstructor = typeof import('jspdf').default
type Html2CanvasRenderer = typeof import('html2canvas').default

let pdfRuntimePromise: Promise<{
  jsPDF: JsPdfConstructor
  html2canvas: Html2CanvasRenderer
}> | null = null

async function loadPdfRuntime() {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([import('jspdf'), import('html2canvas')]).then(
      ([jspdfModule, html2canvasModule]) => ({
        jsPDF: jspdfModule.default,
        html2canvas: html2canvasModule.default,
      }),
    )
  }

  return pdfRuntimePromise
}

export interface PdfExportOptions {
  /** 文件名前缀 (默认 'mechbox') */
  filename?: string
  /** 页面类名选择器 (默认 '.xxx-page') */
  selector?: string
  /** 渲染倍率 (默认 2) */
  scale?: number
  /** 导出完成后回调 */
  onSuccess?: (filename: string) => void
  /** 导出失败回调 */
  onError?: (error: Error) => void
  /** 导出成功后追加到报告中心 */
  reportRecord?: Omit<ReportRecord, 'id' | 'createdAt' | 'type' | 'status'>
}

/**
 * 导出当前页面为 PDF
 * @param options 导出配置
 */
export const usePdfExport = () => {
  const isExporting = ref(false)

  const exportPdf = async (options: PdfExportOptions = {}) => {
    const {
      filename = 'mechbox',
      selector = '.page-stage > *',
      scale = 2,
      onSuccess,
      onError,
      reportRecord,
    } = options

    if (isExporting.value) return

    isExporting.value = true
    try {
      // 查找最近的页面容器
      const element = document.querySelector(selector) as HTMLElement
      if (!element) {
        throw new Error(`未找到导出元素: ${selector}`)
      }

      const { jsPDF, html2canvas } = await loadPdfRuntime()
      const canvas = await html2canvas(element, { scale })
      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

      const fullFilename = `${filename}-${new Date().toISOString().slice(0, 10)}.pdf`
      pdf.save(fullFilename)

      if (reportRecord) {
        const artifactLink =
          reportRecord.linkedRunId || reportRecord.linkedResultId
            ? null
            : resolveLatestWorkflowArtifactLink(reportRecord.module, reportRecord.projectId)
        appendStoredReport({
          ...reportRecord,
          id: `rpt_${Date.now()}`,
          createdAt: new Date().toISOString(),
          type: 'pdf',
          status: 'generated',
          linkedRunId: reportRecord.linkedRunId ?? artifactLink?.runId,
          linkedResultId: reportRecord.linkedResultId ?? artifactLink?.resultId,
        })
      }

      onSuccess?.(fullFilename)
    } catch (error) {
      console.error('PDF 导出失败:', error)
      onError?.(error as Error)
    } finally {
      isExporting.value = false
    }
  }

  return { isExporting, exportPdf }
}
