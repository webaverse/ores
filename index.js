import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
const {useApp, useCamera, useFrame, useLoaders, useGeometries, useMaterials, usePhysics, useSpriting} = metaversefile;

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

export default e => {
  const app = useApp();
  const camera = useCamera();
  const physics = usePhysics();
  const spriting = useSpriting();
  const {SpritesheetMesh} = spriting;

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

        /* const canvas = document.createElement('canvas');
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
        document.body.appendChild(canvas); */

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