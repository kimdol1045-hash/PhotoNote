import 'fake-indexeddb/auto';

if (typeof globalThis.createImageBitmap === 'undefined') {
  // @ts-expect-error stubbing for tests
  globalThis.createImageBitmap = async (_blob: Blob) => ({
    width: 100,
    height: 100,
    close() {},
  });
}

// happy-dom returns null for canvas.getContext('2d'). Stub a no-op 2d context
// so image flatten/thumbnail paths work in tests.
function stubCanvas() {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype;
  const fake2d = {
    drawImage: () => {},
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalCompositeOperation: 'source-over',
  };
  proto.getContext = function () {
    return fake2d as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement['getContext'];
  proto.toBlob = function (cb) {
    cb(new Blob(['x'], { type: 'image/jpeg' }));
  };
}

stubCanvas();
