export const rad = Math.PI / 180;
export const degrees = value => value / rad;
export const wrap = value => ((value % 360) + 360) % 360;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const dot = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

export function sidereal(date, longitude) {
  const days = date.getTime()/86400000 - 10957.5;
  const centuries = days / 36525;
  return wrap(280.46061837 + 360.98564736629*days + 0.000387933*centuries**2
    - centuries**3/38710000 + longitude);
}

// Horizontal coordinates in east, north, up order.
export function horizontal(ra, dec, latitude, lst) {
  const hour = (lst-ra)*rad;
  const phi = latitude*rad;
  const d = dec*rad;
  const meridian = Math.cos(d)*Math.cos(hour);
  return [-Math.cos(d)*Math.sin(hour),
    Math.sin(d)*Math.cos(phi)-meridian*Math.sin(phi),
    Math.sin(d)*Math.sin(phi)+meridian*Math.cos(phi)];
}

export function view(azimuth, altitude, roll = 0) {
  const a = azimuth*rad, b = altitude*rad, r = roll*rad;
  const right = [Math.cos(a), -Math.sin(a), 0];
  const up = [-Math.sin(a)*Math.sin(b),-Math.cos(a)*Math.sin(b),Math.cos(b)];
  return {
    forward: [Math.sin(a)*Math.cos(b),Math.cos(a)*Math.cos(b),Math.sin(b)],
    right: right.map((x,i) => x*Math.cos(r)+up[i]*Math.sin(r)),
    up: up.map((x,i) => x*Math.cos(r)-right[i]*Math.sin(r))
  };
}

// Device axes follow the W3C intrinsic Z-X′-Y″ rotation order.
// Rear-camera direction is negative device Z.
export function orientation(alpha,beta,gamma,screenAngle=0) {
  const a=alpha*rad, b=beta*rad, g=gamma*rad, s=screenAngle*rad;
  const ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(b), sb=Math.sin(b);
  const cg=Math.cos(g), sg=Math.sin(g);
  const x=[ca*cg-sa*sb*sg,sa*cg+ca*sb*sg,-cb*sg];
  const y=[-sa*cb,ca*cb,sb];
  const forward=[-ca*sg-sa*sb*cg,-sa*sg+ca*sb*cg,-cb*cg];
  return {
    forward,
    right:x.map((v,i)=>v*Math.cos(s)-y[i]*Math.sin(s)),
    up:y.map((v,i)=>v*Math.cos(s)+x[i]*Math.sin(s))
  };
}

export function azimuth([east,north]) {
  return wrap(degrees(Math.atan2(east,north)));
}
