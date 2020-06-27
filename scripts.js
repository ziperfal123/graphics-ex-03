// Amit Levy - 311133433
// Yaniv Ziperfal - 203311303
// Eran Maron - 037040458

const PROJECTIONS = {
  oblique: "oblique",
  perspective: "perspective",
  parallel: "parallel"
};

const projectionBtns = document.getElementsByClassName("projection-radio-btn");
const scalingBtn = document.getElementById("scaling-btn");
const rotationBtns = document.getElementsByClassName("rotation-btn");
const uploadedFile = document.getElementById("uploaded-file");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const clearBtn = document.getElementById("clear-canvas-btn");
const defaultZoomValue = 100;
const { maxBy, minBy } = _;
let rotationAngleInput = document.getElementById("rotation-angle");
let obliqueAngleInput = document.getElementById("oblique-angle");
let scalingInput = document.getElementById("scaling-input");
let canvasCenterPoint = new Point(canvas.width / 2, canvas.height / 2, -500);
let fileData;
let pointsArr = [];
let polygonsArr = [];
let drawnPolygons = [];
let colorsArr = [];
let rotationAngleValue = 15;
let scalingValue = 100;
let obliqueAngleValue = 45;
let rotationAxis = "x";
let projectionValue = PROJECTIONS.parallel;

function Point(x = 0, y = 0, z = 0) {
  this.x = x;
  this.y = y;
  this.z = z;
}

class Polygon {
  constructor(points_index, color) {
    this.points_index = points_index;
    this.color = color;
    this.poly__syncPoints();
  }

  poly__draw() {
    if (!this.poly__isVisible()) return false;

    let points = this.points;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    context.fillStyle = this.color;

    for (let i = 1; i < this.points.length - 1; i++) {
      context.lineTo(points[i].x, points[i].y);
    }
    context.closePath();
    context.fill();
    context.stroke();
  }

  poly__oblique(obliqueAngleValue) {
    const rad = convertAngleToRadian(obliqueAngleValue);
    const matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0.5 * Math.cos(rad), 0.5 * Math.sin(rad), 1, 0],
      [0, 0, 0, 1]
    ];

    let newPoints = [];
    for (let point of this.points) {
      const vector = [[point.x, point.y, point.z, 1]];
      const mult = multiplyMatrix(vector, matrix);
      newPoints.push({ x: mult[0][0], y: mult[0][1], z: mult[0][2] });
    }
    this.points = newPoints;
    this.poly__setNormal();
  }

  poly__perspective() {
    let newPoints = [];
    for (let point of this.points) {
      const Sz = 1 / (1 + point.z / canvasCenterPoint.z);
      const matrix = [[Sz, 0, 0, 0], [0, Sz, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]];
      const vector = [[point.x, point.y, point.z, 1]];
      const mult = multiplyMatrix(vector, matrix);
      newPoints.push({ x: mult[0][0], y: mult[0][1], z: mult[0][2] });
    }
    this.points = newPoints;
    this.poly__setNormal();
  }

  poly__parallel() {
    let newPoints = [];
    const matrix = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let point of this.points) {
      const vector = [[point.x, point.y, 0, 1]];
      const mult = multiplyMatrix(vector, matrix);
      newPoints.push({ x: mult[0][0], y: mult[0][1], z: mult[0][2] });
    }
    this.points = newPoints;
    this.poly__setNormal();
  }

  poly__isVisible() {
    return this.normal.z < 0;
  }

  poly__syncPoints() {
    this.points = [];
    let orgPoints = [];
    for (let index of this.points_index)
      orgPoints.push({ ...pointsArr[index] });

    orgPoints.push({ ...pointsArr[this.points_index[0]] });

    this.points = orgPoints;
    this.poly__setNormal();
  }

  poly__setNormal() {
    const p0 = this.points[0];
    const p1 = this.points[1];
    const p2 = this.points[2];

    const a = { x: p0.x - p1.x, y: p0.y - p1.y, z: p0.z - p1.z };
    const b = { x: p0.x - p2.x, y: p0.y - p2.y, z: p0.z - p2.z };
    let normal = {
      x: a.x * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
    this.normal = normal;
  }
}

/***************************************************************/
/* App Initializations */
/***************************************************************/

(function init() {
  rotationAngleInput.value = rotationAngleValue;
  scalingInput.value = scalingValue;
  obliqueAngleInput.value = obliqueAngleValue;

  uploadedFile.addEventListener("change", parseFile);

  obliqueAngleInput.addEventListener("change", setObliqueAngle);
  scalingInput.addEventListener("change", setScale);
  scalingBtn.addEventListener("click", handleScale);
  rotationAngleInput.addEventListener("change", setRotationAngle);

  for (let i = 0; i < rotationBtns.length; i++) {
    rotationBtns[i].addEventListener("click", setRotationAxis);
  }

  for (let i = 0; i < projectionBtns.length; i++) {
    if (projectionBtns[i].value === projectionValue) {
      projectionBtns[i].checked = true;
    }
    projectionBtns[i].addEventListener("click", () => {
      projectionValue = projectionBtns[i].value;
      if (projectionValue === PROJECTIONS.oblique) {
        obliqueAngleInput.style.display = "block";
      } else {
        obliqueAngleInput.style.display = "none";
      }
      draw();
    });
  }

  clearBtn.addEventListener("click", () => {
    fileData = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
  });
})();

function initPolygons(input) {
  pointsArr = input.points;
  polygonsArr = input.polygons;
  colorsArr = input.colors;

  normalizePoints();
  polygonsArr.forEach((poly, index) => {
    drawnPolygons.push(new Polygon(poly, colorsArr[index]));
  });

  draw();
}

function normalizePoints() {
  const tmpPointsArr = [...pointsArr];
  const normalizedPointsArr = [];

  const xMax = maxBy(tmpPointsArr, "x").x;
  const xMin = minBy(tmpPointsArr, "x").x;
  const yMax = maxBy(tmpPointsArr, "y").y;
  const yMin = minBy(tmpPointsArr, "y").y;

  for (let i = 0; i < tmpPointsArr.length; i++) {
    const p = tmpPointsArr[i];
    const tmpPoint = {
      x: Math.abs(p.x - xMin) + Math.round(canvas.width / 2 - xMax),
      y: Math.abs(p.y - yMin) + Math.round(canvas.height / 2 - yMax),
      z: p.z
    };
    normalizedPointsArr.push(tmpPoint);
  }
  pointsArr = normalizedPointsArr;
}

/***************************************************************/
/* File IO */
/***************************************************************/

function parseFile() {
  const file = uploadedFile.files && uploadedFile.files[0];

  if (!file) {
    alert("Please upload file");
    return;
  }

  const fileReader = new FileReader();

  fileReader.onload = ev => {
    fileData = JSON.parse(ev.target.result);
    initPolygons(fileData);
  };
  fileReader.readAsText(file);
}

/***************************************************************/
/* Set Actions */
/***************************************************************/

function setObliqueAngle(e) {
  obliqueAngleValue = e.target.value;
}

function setRotationAxis(e) {
  switch (e.target.value) {
    case "rotationX":
      rotationAxis = "x";
      break;

    case "rotationY":
      rotationAxis = "y";
      break;

    case "rotationZ":
      rotationAxis = "z";
      break;

    default:
      rotationAxis = "x";
      break;
  }
  handleRotation();
}

function setRotationAngle(e) {
  rotationAngleValue = e.target.value;
}

function setScale(e) {
  scalingValue = e.target.value;
}

/***************************************************************/
/* Handle actions */
/***************************************************************/

function handleProjection() {
  switch (projectionValue) {
    case PROJECTIONS.oblique:
      drawnPolygons.forEach(poly => poly.poly__oblique(obliqueAngleValue));
      break;
    case PROJECTIONS.perspective:
      drawnPolygons.forEach(poly => poly.poly__perspective());
      break;
    case PROJECTIONS.parallel:
      drawnPolygons.forEach(poly => poly.poly__parallel());
      break;
  }
}

function handleRotation() {
  rotate(rotationAxis);
  draw();
}

function handleScale() {
  scale(scalingValue / defaultZoomValue);
  draw();
}

/***************************************************************/
/* Handle Polygons */
/***************************************************************/

function draw() {
  console.log("in draw");
  clearPolygons();
  handleProjection();
  drawnPolygons.forEach(poly => poly.poly__draw());
}
function clearPolygons() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.beginPath();
  context.moveTo(0, 0);
  drawnPolygons.forEach(poly => poly.poly__syncPoints());
}

function syncPoints() {
  drawnPolygons.forEach(poly => poly.poly__syncPoints());
}

/***************************************************************/
/* Math utils */
/***************************************************************/

function convertAngleToRadian(angle) {
  return angle * (Math.PI / 180);
}
function multiplyMatrix(a, b) {
  var aNumRows = a.length,
    aNumCols = a[0].length,
    bNumRows = b.length,
    bNumCols = b[0].length,
    m = new Array(aNumRows); // initialize array of rows
  for (var r = 0; r < aNumRows; ++r) {
    m[r] = new Array(bNumCols); // initialize the current row
    for (var c = 0; c < bNumCols; ++c) {
      m[r][c] = 0; // initialize the current cell
      for (var i = 0; i < aNumCols; ++i) {
        m[r][c] += a[r][i] * b[i][c];
      }
    }
  }
  return m;
}

function getMatrixAccordingToAxis(ax) {
  const rad = this.convertAngleToRadian(rotationAngleValue);
  switch (ax) {
    case "x":
      return [
        [1, 0, 0, 0],
        [0, Math.cos(rad), Math.sin(rad), 0],
        [0, -Math.sin(rad), Math.cos(rad), 0],
        [0, 0, 0, 1]
      ];

    case "y":
      return [
        [Math.cos(rad), 0, -Math.sin(rad), 0],
        [0, 1, 0, 0],
        [Math.sin(rad), 0, Math.cos(rad), 0],
        [0, 0, 0, 1]
      ];

    case "z":
      return [
        [Math.cos(rad), Math.sin(rad), 0, 0],
        [-Math.sin(rad), Math.cos(rad), 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ];
  }
}

/***************************************************************/
/* Actions */
/***************************************************************/

function scale(zoonInput) {
  pointsArr.forEach((point, index) => {
    let newPoint = {
      x: (point.x - canvasCenterPoint.x) * zoonInput + canvasCenterPoint.x,
      y: (point.y - canvasCenterPoint.y) * zoonInput + canvasCenterPoint.y,
      z: point.z * zoonInput
    };
    pointsArr[index] = newPoint;
  });
  syncPoints();
}

function rotate(ax) {
  const matrix = getMatrixAccordingToAxis(ax);
  pointsArr.forEach((point, i) => {
    const vector = [
      [point.x - canvasCenterPoint.x, point.y - canvasCenterPoint.y, point.z, 1]
    ];
    const mult = multiplyMatrix(vector, matrix);
    let newPoint = {
      x: mult[0][0] + canvasCenterPoint.x,
      y: mult[0][1] + canvasCenterPoint.y,
      z: mult[0][2]
    };
    pointsArr[i] = newPoint;
  });
  syncPoints();
}
