import {rad, degrees, wrap, dot, horizontal, azimuth, view} from './sky.mjs';

const sin = angle => Math.sin(angle * rad);
const cos = angle => Math.cos(angle * rad);
const cross = ([x,y,z], [a,b,c]) => [y*c-z*b, z*a-x*c, x*b-y*a];

// Approximate lunar orbit and principal perturbations, after Paul Schlyter.
// https://stjarnhimlen.se/comp/ppcomp.html
export function moonDirection(date, latitude, lst) {
  const days = date.getTime() / 86400000 - 10956;
  const node = wrap(125.1228 - .0529538083 * days);
  const perigee = wrap(318.0634 + .1643573223 * days);
  const anomaly = wrap(115.3654 + 13.0649929509 * days);
  const solarAnomaly = wrap(356.0470 + .9856002585 * days);
  const elongation = anomaly + perigee + node - solarAnomaly - (282.9404 + .0000470935 * days);
  const latitudeArgument = anomaly + perigee;
  const eccentricity = .0549;
  const eccentricAnomaly = anomaly + degrees(eccentricity * sin(anomaly)
    * (1 + eccentricity * cos(anomaly)));
  const x = cos(eccentricAnomaly) - eccentricity;
  const y = Math.sqrt(1 - eccentricity ** 2) * sin(eccentricAnomaly);
  const argument = degrees(Math.atan2(y,x)) + perigee;
  const longitude = node + degrees(Math.atan2(sin(argument) * cos(5.1454), cos(argument)))
    - 1.274 * sin(anomaly - 2 * elongation) + .658 * sin(2 * elongation) - .186 * sin(solarAnomaly);
  const eclipticLatitude = degrees(Math.asin(sin(argument) * sin(5.1454)))
    - .173 * sin(latitudeArgument - 2 * elongation);
  const distance = 60.2666 * Math.hypot(x,y)
    - .58 * cos(anomaly - 2 * elongation) - .46 * cos(2 * elongation);
  const obliquity = 23.4393 - .0000003563 * days;
  const equatorialX = cos(longitude) * cos(eclipticLatitude);
  const eclipticY = sin(longitude) * cos(eclipticLatitude);
  const eclipticZ = sin(eclipticLatitude);
  const ra = degrees(Math.atan2(eclipticY * cos(obliquity) - eclipticZ * sin(obliquity), equatorialX));
  const dec = degrees(Math.asin(eclipticY * sin(obliquity) + eclipticZ * cos(obliquity)));
  const direction = horizontal(ra,dec,latitude,lst);
  // Subtract the observer's position using a spherical Earth approximation.
  direction[2] -= 1 / distance;
  const length = Math.hypot(...direction);
  return direction.map(value => value / length);
}

export function alignCamera(forward, target) {
  const heading = azimuth(target);
  const yaw = heading - azimuth(forward);
  const altitude = direction => Math.atan2(direction[2],Math.hypot(direction[0],direction[1]));
  const pitch = altitude(target) - altitude(forward);
  const axis = view(heading,0).right;
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return basis => {
    const rotate = ([east,north,up]) => {
      const v = [east*cos(yaw)+north*sin(yaw), north*cos(yaw)-east*sin(yaw), up];
      const perpendicular = cross(axis,v);
      const parallel = dot(axis,v) * (1-c);
      return v.map((value,i) => value*c + perpendicular[i]*s + axis[i]*parallel);
    };
    return {forward:rotate(basis.forward), right:rotate(basis.right), up:rotate(basis.up)};
  };
}

export function cameraFocal(width,height,videoWidth,videoHeight,angle) {
  // The video uses object-fit: cover. Scale the lens estimate by the same crop.
  const visibleScale = Math.max(width/videoWidth,height/videoHeight);
  return visibleScale * Math.max(videoWidth,videoHeight) / (2 * Math.tan(angle * rad / 2));
}
