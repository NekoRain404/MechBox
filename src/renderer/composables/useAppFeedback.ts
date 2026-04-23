import { Modal, message } from 'ant-design-vue'

interface ConfirmOptions {
  title: string
  content: string
  okText?: string
  cancelText?: string
}

export function useAppFeedback() {
  function success(content: string) {
    message.success(content)
  }

  function info(content: string) {
    message.info(content)
  }

  function warning(content: string) {
    message.warning(content)
  }

  function error(content: string) {
    message.error(content)
  }

  function notifySaved(subject = '设置') {
    success(`${subject}已保存`)
  }

  function notifyExported(subject = '文件') {
    success(`${subject}已导出`)
  }

  function notifyDownloaded(subject = '模板') {
    success(`${subject}已生成`)
  }

  function notifyDeleted(subject = '记录') {
    info(`${subject}已删除`)
  }

  function notifyCleared(subject = '内容') {
    warning(`${subject}已清空`)
  }

  function notifyGenerated(subject = '报告') {
    success(`${subject}已生成`)
  }

  function notifyOpened(subject = '项目') {
    info(`已打开${subject}`)
  }

  function confirmDestructive(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: options.title,
        content: options.content,
        okText: options.okText ?? '确认',
        cancelText: options.cancelText ?? '取消',
        okType: 'danger',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  }

  return {
    success,
    info,
    warning,
    error,
    notifySaved,
    notifyExported,
    notifyDownloaded,
    notifyDeleted,
    notifyCleared,
    notifyGenerated,
    notifyOpened,
    confirmDestructive,
  }
}
