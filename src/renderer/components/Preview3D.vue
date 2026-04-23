<script setup lang="ts">
/**
 * 3D参数化预览组件 (Section 4.1/4.2)
 * 内嵌 WebGL (Three.js) 实现数字孪生
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

interface Props {
  type: 'bearing' | 'gear' | 'bolt' | 'spring' | 'shaft'
  params: Record<string, number>
}

const props = defineProps<Props>()
const containerRef = ref<HTMLElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let camera: THREE.PerspectiveCamera | null = null
let scene: THREE.Scene | null = null
let previewObject: THREE.Object3D | null = null
let animationId: number = 0

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const meshChild = child as THREE.Mesh
    if (meshChild.geometry) {
      meshChild.geometry.dispose()
    }
    const material = meshChild.material
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose())
    } else if (material) {
      material.dispose()
    }
  })
}

function initScene() {
  if (!containerRef.value) return
  
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f7ff)
  
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
  camera.position.set(0, 0, 3)
  
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  containerRef.value.appendChild(renderer.domElement)
  
  // 灯光
  scene.add(new THREE.AmbientLight(0x404040, 2))
  const light1 = new THREE.DirectionalLight(0xffffff, 1)
  light1.position.set(5, 5, 5)
  scene.add(light1)
  
  const light2 = new THREE.DirectionalLight(0x8888ff, 0.5)
  light2.position.set(-5, -5, -5)
  scene.add(light2)
  
  // 网格辅助
  const grid = new THREE.GridHelper(5, 10, 0xcccccc, 0xeeeeee)
  grid.rotation.x = Math.PI / 2
  grid.position.z = -1
  scene.add(grid)
}

function updateModel() {
  if (!scene) return
  
  // 移除旧模型
  if (previewObject) {
    scene.remove(previewObject)
    disposeObject(previewObject)
    previewObject = null
  }
  
  let geometry: THREE.BufferGeometry
  let object: THREE.Object3D | null = null
  
  switch (props.type) {
    case 'bearing': {
      const d = (props.params.d || 25) / 100
      const D = (props.params.D || 52) / 100
      const thickness = Math.max((D - d) / 4, 0.02)
      const ringGeo = new THREE.TorusGeometry((d + D) / 4, thickness, 24, 64)
      const mat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.25 })
      object = new THREE.Mesh(ringGeo, mat)
      break
    }
    case 'gear': {
      const m = props.params.m || 2
      const z = props.params.z || 20
      const da = m * (z + 2) / 100
      const df = m * (z - 2.5) / 100
      const b = (props.params.b || 20) / 100
      
      // 简化齿轮为带齿的圆环
      const shape = new THREE.Shape()
      const teeth = z
      for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2
        const a2 = ((i + 0.3) / teeth) * Math.PI * 2
        const a3 = ((i + 0.5) / teeth) * Math.PI * 2
        const a4 = ((i + 0.8) / teeth) * Math.PI * 2
        
        if (i === 0) shape.moveTo(Math.cos(a1) * df / 2, Math.sin(a1) * df / 2)
        shape.lineTo(Math.cos(a2) * df / 2, Math.sin(a2) * df / 2)
        shape.lineTo(Math.cos(a3) * da / 2, Math.sin(a3) * da / 2)
        shape.lineTo(Math.cos(a4) * da / 2, Math.sin(a4) * da / 2)
        shape.lineTo(Math.cos(((i + 1) / teeth) * Math.PI * 2) * df / 2, Math.sin(((i + 1) / teeth) * Math.PI * 2) * df / 2)
      }
      shape.closePath()
      
      const extrudeSettings = { depth: b, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005 }
      geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
      const mat = new THREE.MeshStandardMaterial({ color: 0xcc8844, metalness: 0.6, roughness: 0.35 })
      object = new THREE.Mesh(geometry, mat)
      break
    }
    case 'bolt': {
      const d = (props.params.d || 10) / 100
      const l = (props.params.l || 40) / 100
      const h = (props.params.h || 6) / 100
      
      // 六角螺栓头
      const headGeo = new THREE.CylinderGeometry(d / 1.5, d / 1.5, h, 6)
      const shaftGeo = new THREE.CylinderGeometry(d / 2, d / 2, l - h, 16)
      
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 })
      const head = new THREE.Mesh(headGeo, mat)
      head.position.y = h / 2
      const shaft = new THREE.Mesh(shaftGeo, mat)
      shaft.position.y = - (l - h) / 2
      
      const group = new THREE.Group()
      group.add(head)
      group.add(shaft)
      object = group
      break
    }
    case 'spring': {
      const d = (props.params.d || 2) / 100
      const D = (props.params.D || 16) / 100
      const n = props.params.n || 10
      const freeLength = (props.params.freeLength || props.params.L0 || 100) / 100
      const points = Array.from({ length: n * 24 + 1 }, (_, index) => {
        const t = index / (n * 24)
        const angle = t * n * Math.PI * 2
        return new THREE.Vector3(
          Math.cos(angle) * D / 2,
          t * freeLength - freeLength / 2,
          Math.sin(angle) * D / 2
        )
      })
      const curve = new THREE.CatmullRomCurve3(points)
      geometry = new THREE.TubeGeometry(curve, n * 32, d / 4, 8, false)
      const mat = new THREE.MeshStandardMaterial({ color: 0x4488cc, metalness: 0.5, roughness: 0.35 })
      object = new THREE.Mesh(geometry, mat)
      break
    }
    default: {
      geometry = new THREE.SphereGeometry(0.5, 32, 32)
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 })
      object = new THREE.Mesh(geometry, mat)
    }
  }
  
  if (object) {
    previewObject = object
    scene.add(previewObject)
  }
}

function animate() {
  animationId = requestAnimationFrame(animate)
  if (previewObject) {
    previewObject.rotation.y += 0.005
    previewObject.rotation.x += 0.002
  }
  renderer?.render(scene!, camera!)
}

function onResize() {
  if (!containerRef.value || !camera || !renderer) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  initScene()
  updateModel()
  animate()
  window.addEventListener('resize', onResize)
})

watch(() => props.params, () => {
  updateModel()
}, { deep: true })

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  if (previewObject) {
    disposeObject(previewObject)
    previewObject = null
  }
  renderer?.dispose()
})
</script>

<template>
  <div ref="containerRef" class="preview-3d"></div>
</template>

<style scoped>
.preview-3d {
  width: 100%;
  height: 300px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}
</style>
