import type { PreviewPlugin, PreviewSize } from "../types";
import { createObjectUrl, revokeObjectUrl } from "../dom";

const modelExtensions = new Set(["gltf", "glb", "obj", "stl", "fbx", "dae", "ply", "3mf"]);

export function model3dPlugin(): PreviewPlugin {
  return {
    name: "model3d",
    match(file) {
      return modelExtensions.has(file.extension);
    },
    async render(ctx) {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const url = createObjectUrl(ctx.file);
      const isExternal = Boolean(ctx.file.url);

      const stage = document.createElement("div");
      stage.className = "ofv-model-stage";
      ctx.viewport.append(stage);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf3f4f6);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
      camera.position.set(2.5, 2, 3.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      stage.append(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 2.8));
      const directional = new THREE.DirectionalLight(0xffffff, 2);
      directional.position.set(4, 6, 5);
      scene.add(directional);
      scene.add(new THREE.GridHelper(10, 10, 0xcbd5e1, 0xe5e7eb));

      const loaded = await loadModel(ctx.file.extension, url, THREE);
      if (loaded.message) {
        const message = document.createElement("div");
        message.className = "ofv-model-message";
        message.textContent = loaded.message;
        stage.append(message);
      }
      const object = loaded.object;
      scene.add(object);
      const initialFrame = frameObject(object, camera, controls, THREE);

      let animationFrame = 0;
      const animate = () => {
        controls.update();
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(animate);
      };
      animate();

      const resize = (size: PreviewSize) => {
        const width = Math.max(1, size.width);
        const height = Math.max(1, size.height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resize(ctx.size);

      return {
        command(command) {
          if (command === "zoom-in" || command === "zoom-out") {
            const factor = command === "zoom-in" ? 0.82 : 1.18;
            camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
            camera.updateProjectionMatrix();
            controls.update();
            return true;
          }
          if (command === "zoom-reset") {
            camera.position.copy(initialFrame.cameraPosition);
            controls.target.copy(initialFrame.target);
            camera.near = initialFrame.near;
            camera.far = initialFrame.far;
            camera.updateProjectionMatrix();
            controls.update();
            return true;
          }
          if (command === "rotate-right" || command === "rotate-left") {
            object.rotateY(command === "rotate-right" ? Math.PI / 8 : -Math.PI / 8);
            return true;
          }
          return false;
        },
        resize,
        destroy() {
          window.cancelAnimationFrame(animationFrame);
          controls.dispose();
          renderer.dispose();
          disposeObject(object, THREE);
          stage.remove();
          revokeObjectUrl(url, isExternal);
        }
      };
    }
  };
}

async function loadModel(
  extension: string,
  url: string,
  THREE: typeof import("three")
): Promise<{ object: import("three").Object3D; message?: string }> {
  if (extension === "gltf" || extension === "glb") {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(url);
    return { object: gltf.scene };
  }
  if (extension === "obj") {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    return { object: await new OBJLoader().loadAsync(url) };
  }
  if (extension === "stl") {
    const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
    const geometry = await new STLLoader().loadAsync(url);
    const material = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.55 });
    return { object: new THREE.Mesh(geometry, material) };
  }
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x64748b });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return {
    object: group,
    message: `.${extension} 已识别为 3D 格式，当前内置渲染优先支持 gltf/glb/obj/stl。`
  };
}

function frameObject(
  object: import("three").Object3D,
  camera: import("three").PerspectiveCamera,
  controls: { target: import("three").Vector3; update: () => void },
  THREE: typeof import("three")
): {
  cameraPosition: import("three").Vector3;
  target: import("three").Vector3;
  near: number;
  far: number;
} {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 1);
  const distance = maxSize * 2.4;
  camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = distance * 1000;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  return {
    cameraPosition: camera.position.clone(),
    target: controls.target.clone(),
    near: camera.near,
    far: camera.far
  };
}

function disposeObject(object: import("three").Object3D, THREE: typeof import("three")): void {
  object.traverse((child) => {
    const mesh = child as import("three").Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else if (material instanceof THREE.Material) {
      material.dispose();
    }
  });
}
