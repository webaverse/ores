import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useCamera, useFrame, useLoaders, useGeometries, useMaterials, usePhysics, useSpriting} = metaversefile;

const {DoubleSidedPlaneGeometry} = useGeometries();
const {WebaverseShaderMaterial} = useMaterials();

// const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

//

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localEuler = new THREE.Euler();
const localMatrix = new THREE.Matrix4();

//

function mod(a, n) {
  return ((a % n) + n) % n;
}

//

const urls = [
  `BlueOre_deposit_low.glb`,
  `Iron_Deposit_low.glb`,
  `Ore_Blue_low.glb`,
  `Ore_BrownRock_low.glb`,
  `Ore_Deposit_Red.glb`,
  `Ore_Red_low.glb`,
  `Ore_metal_low.glb`,
  `Ore_wood_low.glb`,
  `Rock_ore_Deposit_low.glb`,
  `TreeOre_low.glb`,
].map(u => {
  return `../procgen-assets/litter/ores/${u}`;
});

//

class SpritesheetMesh extends THREE.Mesh {
  constructor({
    texture,
    worldSize,
    numAngles,
    numSlots,
  }) {
    const geometry = new DoubleSidedPlaneGeometry(worldSize, worldSize)
      .translate(0, worldSize / 2 / 1.5, 0);
    const material = new WebaverseShaderMaterial({
      uniforms: {
        uTex: {
          type: 't',
          value: texture,
          // needsUpdate: true,
        },
        uTime: {
          type: 'f',
          value: 0,
          needsUpdate: true,
        },
        uY: {
          type: 'f',
          value: 0,
          needsUpdate: true,
        },
      },
      vertexShader: `\
        precision highp float;
        precision highp int;

        // attribute vec3 barycentric;
        attribute float ao;
        attribute float skyLight;
        attribute float torchLight;

        // varying vec3 vViewPosition;
        varying vec2 vUv;
        varying vec3 vBarycentric;
        varying float vAo;
        varying float vSkyLight;
        varying float vTorchLight;
        varying vec3 vSelectColor;
        varying vec2 vWorldUv;
        varying vec3 vPos;
        varying vec3 vNormal;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // vViewPosition = -mvPosition.xyz;
          vUv = uv;
        }
      `,
      fragmentShader: `\
        precision highp float;
        precision highp int;

        #define PI 3.1415926535897932384626433832795

        // uniform float sunIntensity;
        uniform sampler2D uTex;
        // uniform vec3 uColor;
        uniform float uTime;
        uniform float uY;
        // uniform vec3 sunDirection;
        // uniform float distanceOffset;
        float parallaxScale = 0.3;
        float parallaxMinLayers = 50.;
        float parallaxMaxLayers = 50.;

        // varying vec3 vViewPosition;
        varying vec2 vUv;
        varying vec3 vBarycentric;
        varying float vAo;
        varying float vSkyLight;
        varying float vTorchLight;
        varying vec3 vSelectColor;
        varying vec2 vWorldUv;
        varying vec3 vPos;
        varying vec3 vNormal;

        void main() {
          float angleIndex = floor(uY * ${numAngles.toFixed(8)});
          float i = angleIndex;
          float x = mod(i, ${numSlots.toFixed(8)});
          float y = (i - x) / ${numSlots.toFixed(8)};

          gl_FragColor = texture(
            uTex,
            vec2(0., 1. - 1./${numSlots.toFixed(8)}) +
              vec2(x, -y)/${numSlots.toFixed(8)} +
              vec2(1.-vUv.x, 1.-vUv.y)/${numSlots.toFixed(8)}
          );

          const float alphaTest = 0.5;
          if (gl_FragColor.a < alphaTest) {
            discard;
          }
          gl_FragColor.a = 1.;
          // gl_FragColor.r += 0.5;
        }
      `,
      transparent: true,
      // depthWrite: false,
      // polygonOffset: true,
      // polygonOffsetFactor: -2,
      // polygonOffsetUnits: 1,
      // side: THREE.DoubleSide,
    });
    super(geometry, material);
    /* this.customPostMaterial = new AvatarSpriteDepthMaterial(undefined, {
      tex,
    }); */

    // this.lastSpriteSpecName = '';
    // this.lastSpriteSpecTimestamp = 0;
  }
}

//

export default e => {
  const app = useApp();
  const camera = useCamera();
  const physics = usePhysics();
  const spriting = useSpriting();
  // const dropManager = useDropManager();

  app.name = 'ores';

  let frameCb = null;
  // let live = true;
  // let reactApp = null;
  // let physicsIds = [];
  e.waitUntil((async () => {
    // const u = `../procgen-assets/litter/ores/ores.glb`;
    // const u = `../procgen-assets/litter/ores/ores_compressed.glb`;

    await Promise.all(urls.slice(0, 1).map(async (u, index) => {
      const meshSize = 3;
      const _loadFullModel = async () => {
        const mesh = await metaversefile.createAppAsync({
          start_url: u,
        });
        mesh.position.y = 0.5;
        mesh.position.x = (-urls.length / 2 + index) * meshSize;
        mesh.scale.multiplyScalar(2);

        app.add(mesh);
        mesh.updateMatrixWorld();
        
        return mesh;
      };
      const _loadOptimizedModel = async mesh => {
        let oreMesh = null;
        mesh.traverse(o => {
          if (oreMesh === null && o.isMesh) {
            oreMesh = o;
          }
        });

        const targetRatio = 0.2;
        const targetError = 0.1;
        const oreMesh2 = await physics.meshoptSimplify(oreMesh, targetRatio, targetError);
        
        oreMesh2.position.y = 0.5;
        oreMesh2.position.x = (-urls.length / 2 + index) * meshSize;
        oreMesh2.position.z += meshSize;
        oreMesh2.scale.multiplyScalar(2);

        app.add(oreMesh2);
        oreMesh2.updateMatrixWorld();
        // console.log('got ore mesh 2', oreMesh, oreMesh2);
        
        return oreMesh2;
      };
      const _loadSpritesheet = async () => {
        const spritesheet = await spriting.createAppUrlSpriteSheet(u, {
          // size: 2048,
          // numFrames: 8,
        });
        const {
          result,
          numFrames,
          frameSize,
          numFramesPerRow,
          worldWidth,
          worldHeight,
        } = spritesheet;

        // console.log('got spritesheet', spritesheet);

        const canvas = document.createElement('canvas');
        canvas.width = result.width;
        canvas.height = result.height;
        canvas.style.cssText = `\
          position: fixed;
          top: 0;
          left: 0;
          width: 512px;
          height: 512px;
        `;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(result, 0, 0);
        document.body.appendChild(canvas);

        const texture = new THREE.Texture(result);
        texture.needsUpdate = true;
        const numAngles = numFrames;
        const numSlots = numFramesPerRow;
        const worldSize = Math.max(worldWidth, worldHeight);
        const spritesheetMesh = new SpritesheetMesh({
          texture,
          worldSize,
          numAngles,
          numSlots,
        });
        spritesheetMesh.position.y = 0.5;
        spritesheetMesh.position.x = (-urls.length / 2 + index) * meshSize;
        spritesheetMesh.position.z += meshSize * 2;
        spritesheetMesh.scale.multiplyScalar(2);
        app.add(spritesheetMesh);
        spritesheetMesh.updateMatrixWorld();

        // animate
        frameCb = () => {
          localQuaternion.setFromRotationMatrix(
            localMatrix.lookAt(
              spritesheetMesh.getWorldPosition(localVector),
              camera.position,
              localVector2.set(0, 1, 0)
            )
          );
          localEuler.setFromQuaternion(localQuaternion, 'YXZ');
          localEuler.x = 0;
          localEuler.z = 0;
          spritesheetMesh.quaternion.setFromEuler(localEuler);
          spritesheetMesh.updateMatrixWorld();
    
          const {material} = spritesheetMesh;
          // material.uniforms.uTime.value = uTime;
          // material.uniforms.uTime.needsUpdate = true;
          material.uniforms.uY.value =
            mod(-localEuler.y + Math.PI/2 + (Math.PI * 2) / numAngles / 2, Math.PI * 2) / (Math.PI * 2);
          material.uniforms.uY.needsUpdate = true;
        };
      };

      await Promise.all([
        _loadFullModel().then(mesh => {
          return _loadOptimizedModel(mesh);
        }),
        _loadSpritesheet(),
      ]);
    }));
  })());

  useFrame(() => {
    frameCb && frameCb();
  });

  return app;
};