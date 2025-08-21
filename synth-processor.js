"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/synth-processor.ts
  var WorkletProcessor = class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.audioFileL = null;
      this.audioFileR = null;
      this.audioFileIndex = 0;
      this.isPlaying = false;
      this.port.onmessage = (event) => {
        if (event.data.type == "initialize") {
          this.audioFileL = event.data.audioFileL;
          this.audioFileR = event.data.audioFileR;
          this.audioFileIndex = 0;
        }
        if (event.data.type == "play") {
          this.isPlaying = event.data.isPlaying;
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
