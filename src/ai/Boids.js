// Classic Boids: separation, alignment, cohesion + seek target
export function computeBoidForce(drone, neighbors, target, config) {
  const {
    separationRadius = 30,
    separationWeight = 1.8,
    alignmentRadius = 80,
    alignmentWeight = 1.0,
    cohesionRadius = 80,
    cohesionWeight = 0.8,
    seekWeight = 1.5,
    maxForce = 0.4,
    maxSpeed = 140,
  } = config || {};

  let sepX = 0, sepY = 0, sepCount = 0;
  let alignVX = 0, alignVY = 0, alignCount = 0;
  let cohX = 0, cohY = 0, cohCount = 0;

  for (const n of neighbors) {
    if (n === drone) continue;
    const dx = drone.x - n.x;
    const dy = drone.y - n.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    if (dist < separationRadius) {
      sepX += (dx / dist) / dist;
      sepY += (dy / dist) / dist;
      sepCount++;
    }
    if (dist < alignmentRadius) {
      alignVX += n.vx;
      alignVY += n.vy;
      alignCount++;
    }
    if (dist < cohesionRadius) {
      cohX += n.x;
      cohY += n.y;
      cohCount++;
    }
  }

  let fx = 0, fy = 0;

  if (sepCount > 0) {
    fx += (sepX / sepCount) * separationWeight;
    fy += (sepY / sepCount) * separationWeight;
  }

  if (alignCount > 0) {
    fx += (alignVX / alignCount - drone.vx) * alignWeight(alignmentWeight);
    fy += (alignVY / alignCount - drone.vy) * alignWeight(alignmentWeight);
  }

  if (cohCount > 0) {
    const toCohX = cohX / cohCount - drone.x;
    const toCohY = cohY / cohCount - drone.y;
    fx += toCohX * cohesionWeight * 0.01;
    fy += toCohY * cohesionWeight * 0.01;
  }

  if (target) {
    const tdx = target.x - drone.x;
    const tdy = target.y - drone.y;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy) || 0.001;
    fx += (tdx / tdist) * maxSpeed * seekWeight * 0.01;
    fy += (tdy / tdist) * maxSpeed * seekWeight * 0.01;
  }

  // clamp
  const fmag = Math.sqrt(fx * fx + fy * fy);
  if (fmag > maxForce) {
    fx = (fx / fmag) * maxForce;
    fy = (fy / fmag) * maxForce;
  }

  return { fx, fy };
}

function alignWeight(w) { return w * 0.05; }
