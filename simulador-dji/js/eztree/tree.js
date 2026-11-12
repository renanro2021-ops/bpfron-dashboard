// Gerador de árvores do ez-tree (MIT, Copyright (c) 2024 Daniel Greenheck — ver LICENSE nesta pasta).
// Adaptado para o simulador: só gera as geometrias (tronco/galhos e folhas). Os materiais (WebGPU/TSL,
// com vento) ficam em js/vegetation.js. A lógica de crescimento é a do original.
import * as THREE from 'three';
import RNG from './rng.js';
import { Branch } from './branch.js';
import { Billboard, TreeType } from './enums.js';
import TreeOptions from './options.js';
import { PRESETS } from './presets.js';

export function presetOptions(name, seed) {
  const o = new TreeOptions();
  o.copy(structuredClone(PRESETS[name]));
  if (seed !== undefined) o.seed = seed;
  return o;
}

export class TreeGen {
  constructor(options) {
    this.options = options;
    this.branchQueue = [];
  }

  // devolve { wood, leaves } (BufferGeometry, na escala do preset)
  generate() {
    this.branches = { verts: [], normals: [], indices: [], uvs: [] };
    this.leaves = { verts: [], normals: [], indices: [], uvs: [] };
    this.rng = new RNG(this.options.seed);
    const b = this.options.branch;
    this.branchQueue.push(new Branch(new THREE.Vector3(), new THREE.Euler(), b.length[0], b.radius[0], 0, b.sections[0], b.segments[0]));
    while (this.branchQueue.length > 0) this.generateBranch(this.branchQueue.shift());
    return { wood: this.geometry(this.branches, true), leaves: this.geometry(this.leaves, false) };
  }

  generateBranch(branch) {
    const o = this.options;
    const indexOffset = this.branches.verts.length / 3;
    const sectionOrientation = branch.orientation.clone();
    const sectionOrigin = branch.origin.clone();
    // (o original compara com 'Deciduous' maiúsculo aqui; mantido para os presets ficarem iguais)
    const sectionLength = branch.length / branch.sectionCount / (o.type === 'Deciduous' ? o.branch.levels - 1 : 1);
    const sections = [];

    for (let i = 0; i <= branch.sectionCount; i++) {
      let sectionRadius = branch.radius;
      if (i === branch.sectionCount && branch.level === o.branch.levels) sectionRadius = 0.001;
      else if (o.type === TreeType.Deciduous) sectionRadius *= 1 - o.branch.taper[branch.level] * (i / branch.sectionCount);
      else if (o.type === TreeType.Evergreen) sectionRadius *= 1 - i / branch.sectionCount;

      let first;
      for (let j = 0; j < branch.segmentCount; j++) {
        const angle = (2.0 * Math.PI * j) / branch.segmentCount;
        const vertex = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(sectionRadius).applyEuler(sectionOrientation).add(sectionOrigin);
        const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).applyEuler(sectionOrientation).normalize();
        const uv = new THREE.Vector2(j / branch.segmentCount, i % 2 === 0 ? 0 : 1);
        this.branches.verts.push(vertex.x, vertex.y, vertex.z);
        this.branches.normals.push(normal.x, normal.y, normal.z);
        this.branches.uvs.push(uv.x, uv.y);
        if (j === 0) first = { vertex, normal, uv };
      }
      this.branches.verts.push(first.vertex.x, first.vertex.y, first.vertex.z);
      this.branches.normals.push(first.normal.x, first.normal.y, first.normal.z);
      this.branches.uvs.push(1, first.uv.y);

      sections.push({ origin: sectionOrigin.clone(), orientation: sectionOrientation.clone(), radius: sectionRadius });
      sectionOrigin.add(new THREE.Vector3(0, sectionLength, 0).applyEuler(sectionOrientation));

      const gnarliness = Math.max(1, 1 / Math.sqrt(sectionRadius)) * o.branch.gnarliness[branch.level];
      sectionOrientation.x += this.rng.random(gnarliness, -gnarliness);
      sectionOrientation.z += this.rng.random(gnarliness, -gnarliness);

      const qSection = new THREE.Quaternion().setFromEuler(sectionOrientation);
      const qTwist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.branch.twist[branch.level]);
      const qForce = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().copy(o.branch.force.direction));
      qSection.multiply(qTwist);
      qSection.rotateTowards(qForce, o.branch.force.strength / sectionRadius);
      sectionOrientation.setFromQuaternion(qSection);
    }

    this.branchIndices(indexOffset, branch);

    if (o.type === 'deciduous') {
      const last = sections[sections.length - 1];
      if (branch.level < o.branch.levels) {
        this.branchQueue.push(new Branch(last.origin, last.orientation, o.branch.length[branch.level + 1], last.radius, branch.level + 1, branch.sectionCount, branch.segmentCount));
      } else {
        this.generateLeaf(last.origin, last.orientation);
      }
    }

    if (branch.level === o.branch.levels) this.generateLeaves(sections);
    else if (branch.level < o.branch.levels) this.generateChildBranches(o.branch.children[branch.level], branch.level + 1, sections);
  }

  // ponto, raio e orientação interpolados ao longo da lista de seções
  along(sections, t) {
    const idx = Math.floor(t * (sections.length - 1));
    const A = sections[idx], B = idx === sections.length - 1 ? A : sections[idx + 1];
    const alpha = (t - idx / (sections.length - 1)) / (1 / (sections.length - 1));
    const origin = new THREE.Vector3().lerpVectors(A.origin, B.origin, alpha);
    const qA = new THREE.Quaternion().setFromEuler(A.orientation), qB = new THREE.Quaternion().setFromEuler(B.orientation);
    const orientation = new THREE.Euler().setFromQuaternion(qB.slerp(qA, alpha));
    return { origin, orientation, A, B, alpha };
  }
  turn(parent, angleDeg, radial) {
    const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleDeg / (180 / Math.PI));
    const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), radial);
    const q3 = new THREE.Quaternion().setFromEuler(parent);
    return new THREE.Euler().setFromQuaternion(q3.multiply(q2.multiply(q1)));
  }

  generateChildBranches(count, level, sections) {
    const o = this.options;
    const radialOffset = this.rng.random();
    for (let i = 0; i < count; i++) {
      const start = this.rng.random(1.0, o.branch.start[level]);
      const s = this.along(sections, start);
      const radius = o.branch.radius[level] * ((1 - s.alpha) * s.A.radius + s.alpha * s.B.radius);
      const orientation = this.turn(s.orientation, o.branch.angle[level], 2.0 * Math.PI * (radialOffset + i / count));
      const length = o.branch.length[level] * (o.type === TreeType.Evergreen ? 1.0 - start : 1.0);
      this.branchQueue.push(new Branch(s.origin, orientation, length, radius, level, o.branch.sections[level], o.branch.segments[level]));
    }
  }

  generateLeaves(sections) {
    const o = this.options;
    const radialOffset = this.rng.random();
    for (let i = 0; i < o.leaves.count; i++) {
      const s = this.along(sections, this.rng.random(1.0, o.leaves.start));
      this.generateLeaf(s.origin, this.turn(s.orientation, o.leaves.angle, 2.0 * Math.PI * (radialOffset + i / o.leaves.count)));
    }
  }

  generateLeaf(origin, orientation) {
    const o = this.options;
    let i = this.leaves.verts.length / 3;
    const size = o.leaves.size * (1 + this.rng.random(o.leaves.sizeVariance, -o.leaves.sizeVariance));
    const W = size, L = size;
    const quad = (rotation) => {
      const v = [new THREE.Vector3(-W / 2, L, 0), new THREE.Vector3(-W / 2, 0, 0), new THREE.Vector3(W / 2, 0, 0), new THREE.Vector3(W / 2, L, 0)]
        .map((p) => p.applyEuler(new THREE.Euler(0, rotation, 0)).applyEuler(orientation).add(origin));
      for (const p of v) this.leaves.verts.push(p.x, p.y, p.z);
      const n = new THREE.Vector3(0, 0, 1).applyEuler(orientation);
      for (let k = 0; k < 4; k++) this.leaves.normals.push(n.x, n.y, n.z);
      this.leaves.uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
      this.leaves.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
      i += 4;
    };
    quad(0);
    if (o.leaves.billboard === Billboard.Double) quad(Math.PI / 2);
  }

  branchIndices(indexOffset, branch) {
    const N = branch.segmentCount + 1;
    for (let i = 0; i < branch.sectionCount; i++) {
      for (let j = 0; j < branch.segmentCount; j++) {
        const v1 = indexOffset + i * N + j, v2 = indexOffset + i * N + (j + 1), v3 = v1 + N, v4 = v2 + N;
        this.branches.indices.push(v1, v3, v2, v2, v3, v4);
      }
    }
  }

  geometry(d, withNormals) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.verts), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(d.normals), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(d.uvs), 2));
    const n = d.verts.length / 3;
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(d.indices) : new Uint16Array(d.indices), 1));
    if (!withNormals) g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
