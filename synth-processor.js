"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // js/wasmImport.ts
  async function loadPlugin(wasmBytes) {
    let HEAPU8;
    let HEAPU32;
    let HEAPF64;
    const readCStr = /* @__PURE__ */ __name((ptr) => {
      var buf = [];
      for (; HEAPU8[ptr] !== 0; ++ptr) {
        buf.push(HEAPU8[ptr]);
      }
      return String.fromCharCode(...buf);
    }, "readCStr");
    const wasmImports = {
      bpbxplug: {
        log(str) {
          console.log(readCStr(str));
        }
      }
    };
    const obj = await WebAssembly.instantiate(wasmBytes, wasmImports);
    const wasmInstance = obj.instance;
    const memory = wasmInstance.exports.memory;
    console.log(memory);
    const funcTable = wasmInstance.exports.__indirect_function_table;
    const malloc = wasmInstance.exports.malloc;
    const free = wasmInstance.exports.free;
    HEAPU8 = new Uint8Array(memory.buffer);
    HEAPU32 = new Uint32Array(memory.buffer);
    HEAPF64 = new Float64Array(memory.buffer);
    {
      const initFunc = wasmInstance.exports._initialize;
      if (initFunc !== void 0)
        initFunc();
    }
    const moduleStruct = wasmInstance.exports.bpbxplug_entry();
    const moduleApiVersionStr = HEAPU32[moduleStruct >> 2];
    const apiVersion = readCStr(moduleApiVersionStr);
    const init = funcTable.get(HEAPU32[moduleStruct + 4 >> 2]);
    const destroy = funcTable.get(HEAPU32[moduleStruct + 8 >> 2]);
    const tick = funcTable.get(HEAPU32[moduleStruct + 12 >> 2]);
    const render = funcTable.get(HEAPU32[moduleStruct + 16 >> 2]);
    console.log(apiVersion);
    if (apiVersion !== "0.0.1") {
      console.error("unsupported version " + apiVersion);
    }
    const sizeOfPluginStruct = 40;
    const pluginPointer = malloc(sizeOfPluginStruct);
    if (pluginPointer === 0) {
      console.error("could not allocate plugin instance");
      destroy(pluginPointer);
      return;
    }
    for (let i = 0; i < sizeOfPluginStruct; ++i) {
      HEAPU8[pluginPointer + i] = 0;
    }
    const paramCount = 1;
    HEAPU32[pluginPointer + 8 >> 2] = paramCount;
    const paramData = malloc(paramCount * 8);
    if (paramData === 0) {
      console.error("could not allocate plugin instance");
      destroy(pluginPointer);
      free(pluginPointer);
      return;
    }
    for (let i = 0; i < paramCount; ++i) {
      HEAPF64[(paramData >> 3) + i] = 0;
    }
    HEAPU32[pluginPointer + 12 >> 2] = paramData;
    HEAPF64[pluginPointer + 24 >> 3] = 48e3;
    init(pluginPointer);
    const tickContextPointer = malloc(24);
    const renderContextPointer = malloc(12);
    const ch0Pointer = malloc(8 * 128);
    const ch1Pointer = malloc(8 * 128);
    return {
      apiVersion,
      init: /* @__PURE__ */ __name(() => init(pluginPointer), "init"),
      destroy: /* @__PURE__ */ __name(() => {
        destroy(pluginPointer);
        free(pluginPointer);
        free(tickContextPointer);
        free(renderContextPointer);
        free(ch0Pointer);
        free(ch1Pointer);
      }, "destroy"),
      tick: /* @__PURE__ */ __name((tickContext) => {
        HEAPU32[tickContextPointer >> 2] = tickContext.bpm;
        HEAPU32[tickContextPointer + 8 >> 2] = tickContext.beat;
        HEAPU32[tickContextPointer + 16 >> 2] = tickContext.samplesPerTick;
        tick(pluginPointer, tickContextPointer);
      }, "tick"),
      render: /* @__PURE__ */ __name((renderContext) => {
        HEAPU32[renderContextPointer >> 2] = renderContext.runLength;
        HEAPU8[renderContextPointer + 4] = renderContext.channelCount;
        HEAPU32[renderContextPointer + 8 >> 2] = ch0Pointer;
        HEAPU32[renderContextPointer + 12 >> 2] = ch1Pointer;
        for (let i = 0; i < renderContext.runLength; i++) {
          HEAPF64[(ch0Pointer >> 3) + i] = renderContext.samples[0][i];
        }
        if (renderContext.channelCount == 2 /* stereo */) {
          for (let i = 0; i < renderContext.runLength; i++) {
            HEAPF64[(ch1Pointer >> 3) + i] = renderContext.samples[1][i];
          }
        }
        render(pluginPointer, renderContextPointer);
        for (let i = 0; i < renderContext.runLength; i++) {
          renderContext.samples[0][i] = HEAPF64[(ch0Pointer >> 3) + i];
        }
        if (renderContext.channelCount == 2 /* stereo */) {
          for (let i = 0; i < renderContext.runLength; i++) {
            renderContext.samples[1][i] = HEAPF64[(ch1Pointer >> 3) + i];
          }
        }
      }, "render"),
      setParam: /* @__PURE__ */ __name((index, data) => {
        HEAPF64[(paramData >> 3) + index] = data;
      }, "setParam"),
      getParam: /* @__PURE__ */ __name((index) => HEAPF64[(paramData >> 3) + index], "getParam")
    };
  }
  __name(loadPlugin, "loadPlugin");

  // js/synth-processor.ts
  var WorkletProcessor = class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.audioFileL = null;
      this.audioFileR = null;
      this.audioFileIndex = 0;
      this.isPlaying = false;
      this.pluginModule = void 0;
      this.port.onmessage = (event) => {
        if (event.data.type == "initialize") {
          this.audioFileL = event.data.audioFileL;
          this.audioFileR = event.data.audioFileR;
          this.audioFileIndex = 0;
          this.pluginModule = event.data.plugin;
        }
        if (event.data.type == "play") {
          this.isPlaying = event.data.isPlaying;
        }
        if (event.data.type == "plugin") {
          loadPlugin(event.data.wasmBytes).then((plugin) => this.pluginModule = plugin).then(() => {
            this.pluginModule?.setParam(1, 2);
          }).then(() => {
            console.log(this.pluginModule?.getParam(0));
          });
        }
        if (event.data.type == "pluginData") {
          this.pluginModule?.setParam(0, event.data.pluginData);
        }
      };
    }
    static {
      __name(this, "WorkletProcessor");
    }
    process(_, outputs) {
      const outputDataL = outputs[0][0];
      const outputDataR = outputs[0][1];
      if (this.isPlaying && this.audioFileL && this.audioFileR) {
        for (let i = 0; i < outputDataL.length; i++) {
          outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
          outputDataR[i] = this.audioFileR[this.audioFileIndex + i];
        }
        this.audioFileIndex += outputDataL.length;
        if (this.audioFileIndex >= this.audioFileL.length) {
          this.audioFileIndex %= this.audioFileL.length;
        }
      } else if (this.isPlaying && this.audioFileL) {
        for (let i = 0; i < outputDataL.length; i++) {
          outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
          outputDataR[i] = this.audioFileL[this.audioFileIndex + i];
        }
        this.audioFileIndex += outputDataL.length;
        if (this.audioFileIndex >= this.audioFileL.length) {
          this.audioFileIndex %= this.audioFileL.length;
        }
      } else {
        outputDataL.fill(0);
        outputDataR.fill(0);
      }
      if (this.pluginModule && this.isPlaying) {
        const tickContext = {
          bpm: 150,
          //bpm and beat don't really exist in this context
          beat: 4,
          samplesPerTick: outputDataL.length
          //you could technically handle many render sizes, but here I'm only doing one
        };
        this.pluginModule.tick(tickContext);
        const renderContextL = {
          runLength: outputDataL.length,
          channelCount: 1 /* mono */,
          samples: [outputDataL]
        };
        const renderContextR = {
          runLength: outputDataR.length,
          channelCount: 1 /* mono */,
          samples: [outputDataR]
        };
        this.pluginModule.render(renderContextL);
        this.pluginModule.render(renderContextR);
      }
      this.port.postMessage({
        type: "render",
        displayOutput: outputDataL.slice()
      });
      return true;
    }
  };
  registerProcessor("synth-processor", WorkletProcessor);
})();
//# sourceMappingURL=synth-processor.js.map
