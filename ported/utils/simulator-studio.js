import * as THREE from "three";
function lightformer(scene, width, height, intensity, position, target = [0, 0, 0], tint = 16777215) {
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  panel.position.set(...position);
  panel.lookAt(...target);
  scene.add(panel);
}
function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(2763310);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(7105650), side: THREE.BackSide, toneMapped: false }));
  studio.add(dome);
  lightformer(studio, 14, 7, 3.4, [0, 9, 3]);
  lightformer(studio, 2, 16, 8, [-8, 1, 3]);
  lightformer(studio, 2, 16, 6, [8, 0, 1]);
  lightformer(studio, 16, 2, 3, [0, -2, -9], [0, 0, 0], 16773599);
  lightformer(studio, 10, 7, 4.5, [4.5, 5, -12]);
  lightformer(studio, 20, 14, 1.3, [0, 0, 12]);
  lightformer(studio, 30, 30, 0.3, [0, -10, 0], [0, 0, 0], 15789026);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(studio, 0.015).texture;
  pmrem.dispose();
  studio.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      node.material.dispose();
    }
  });
  return texture;
}
function studioFloor(scene) {
  const hemisphere = new THREE.HemisphereLight(16777215, 14275788, 0.45);
  const fill = new THREE.DirectionalLight(16775408, 0.9);
  fill.position.set(-6, 3, 6);
  const back = new THREE.DirectionalLight(16777215, 0.45);
  back.position.set(3, 4, -7);
  scene.add(hemisphere, fill, back);
  const key = new THREE.DirectionalLight(16777215, 2);
  key.position.set(2.5, 9, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 9;
  key.shadow.bias = -4e-4;
  key.shadow.blurSamples = 16;
  scene.add(key, key.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22, transparent: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return {
    key,
    place(bottom, span) {
      floor.position.y = bottom - span * 0.06;
      const camera = key.shadow.camera;
      camera.left = camera.bottom = -span;
      camera.right = camera.top = span;
      camera.near = 0.5;
      camera.far = span * 6 + 20;
      camera.updateProjectionMatrix();
    },
    dispose() {
      floor.geometry.dispose();
      floor.material.dispose();
      key.dispose();
      fill.dispose();
      back.dispose();
      hemisphere.dispose();
    }
  };
}
export {
  studioEnvironment,
  studioFloor
};
