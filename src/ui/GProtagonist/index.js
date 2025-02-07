import { defineComponent, markRaw } from 'vue'
import { IcosahedronGeometry, Color, ShaderMaterial, Mesh, Euler, Quaternion, Vector3 } from 'three'
import { UPDATE, DRAW, AXIS_CHANGED } from '@Events'
import { BLOOM_LAYER } from '@Scene/layers'
import { PRIMARY_AXIS } from '@Input'
import { subscribe, unsubscribe } from '@Messenger'

import vertexShader from './protagonist.vert.glsl'
import fragmentShader from './protagonist.frag.glsl'

export default defineComponent({
  name: 'GProtagonist',

  inject: ['renderer', 'input', 'camera', 'scene', 'resources', 'navMesh'],
  emits: ['move', 'load'],

  data: () => markRaw({
    assets: {
      navigator: require('@/assets/Navigator.fbx').default
    },
    mesh: null,
    geometry: null,
    material: null,
    acceleration: 60,
    velocity: new Vector3(0, 0, 0)
  }),

  props: {
    size: {
      type: Number,
      default: 1
    },
    detail: {
      type: Number,
      default: 10
    },
    position: {
      type: Array,
      default: () => ([0, 0, 0])
    },
    maxVelocity: {
      type: Number,
      default: 15
    }
  },

  computed: {
    primaryAxis () {
      return this.input.getAxis(PRIMARY_AXIS)
    },

    isMoving () {
      return this.primaryAxis.lengthSq() > 0
    }
  },

  watch: {
    size: { handler: 'setSize' },
    position: { handler: 'setPosition' }
  },

  async mounted () {
    this.geometry = new IcosahedronGeometry(1, this.detail)
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        color: {
          type: 'v3',
          value: new Color(0xff0000)
        },
        time: this.renderer.time
      },
    })

    this.redLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff0000 }))
    this.greenLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x00ff00 }))
    this.blueLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x0000ff }))

    // this.scene.add(this.line)

    this.resources.loadObject(this.assets.navigator, this.material)
      .then(obj => {

        this.mesh = obj
        this.scene.add(obj)

        obj.traverse(node => {
          // if empty then type is a Group with children
          if (node.isMesh)
            node.layers.enable(BLOOM_LAYER)
        })

        this.setPosition(this.position)
        this.setSize(this.size)

        this.$emit('load', obj)

        subscribe(UPDATE, this.onUpdate)
        subscribe(DRAW, this.onDraw)

        const a = this.mesh.position
        const b = new Vector3(0, 0, -8)
        const groupID = this.navMesh.pathfinding.getGroup('Level 1', a)
        const path = this.navMesh.pathfinding.findPath(a, b, 'Level 1', groupID)
      })
  },

  beforeUnmount () {
    this.scene.remove(this.mesh)
    this.geometry.dispose()
    this.material.dispose()
    this.mesh.remove()

    unsubscribe(UPDATE, this.onUpdate)
    unsubscribe(DRAW, this.onDraw)
  },

  render: () => ([]),

  methods: {
    setSize (value) {
      this.mesh.scale.set(value, value, value)
    },

    setPosition ([ x, y, z ]) {
      this.mesh.position.set(x, y, z)
    },

    onUpdate ({ deltaTime }) {
      this.adjustVelocity(deltaTime)

      /*this.mesh.position.add(
        this.velocity.clone().multiplyScalar(deltaTime)
      )*/

      const position = this.mesh.position.clone().add(
        this.velocity.clone().multiplyScalar(deltaTime)
      )

      try {
        const groupID = this.navMesh.pathfinding.getGroup('Level 1', position)
        const node = this.navMesh.pathfinding.getClosestNode(position, 'Level 1', groupID, true)

        if (node) {
          this.mesh.position.add(
            this.velocity.clone().multiplyScalar(deltaTime)
          )
        }
      } catch (e) {
        console.error(e)
      }
    },

    drawLine (line, start, end, offset = new Vector3(0, 1, 0)) {
      const v1 = start.clone().add(offset)
      const v2 = end.clone().add(offset)

      line.geometry.setFromPoints([ v1, v2 ])
    },

    onDraw () {
      // this.drawLine(this.redLine, this.mesh.position, this.mesh.position.clone().add(this.velocity))
    },

    adjustVelocity (deltaTime) {
      const direction = this.getOrientedDirection(this.primaryAxis)

      if (this.isMoving) {
        direction.multiplyScalar(this.acceleration * deltaTime)

        this.velocity.add(direction)

        const smoothDirection = new Vector3(0, 0, 1)
          .applyQuaternion(this.mesh.quaternion)
          .lerp(direction, deltaTime * 5.)
          .add(this.mesh.position)

        this.mesh.lookAt(smoothDirection)

        this.$emit('move', this.mesh.position)
      } else {
        this.velocity.multiplyScalar(1.0 - deltaTime * 3.)
      }

      this.velocity.clampLength(0, this.maxVelocity)
    },

    getOrientedDirection (direction) {
      const { mainCamera } = this.camera

      const right = new Vector3(1, 0, 0).applyQuaternion(mainCamera.quaternion)
      right.y = 0
      right.normalize()

      const forward = new Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion)
      forward.y = 0
      forward.normalize()

      return right.multiplyScalar(direction.x)
        .add(forward.multiplyScalar(direction.y))
    }
  }
})
