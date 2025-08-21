class WorkletProcessor extends AudioWorkletProcessor {
    private audioFileL: Float32Array | null = null;
    private audioFileR: Float32Array | null = null;
    private audioFileIndex: number = 0;
    private isPlaying: boolean = false;

    constructor() {
        super();

        this.port.onmessage = (event) => {
            if (event.data.type == 'initialize') {
                this.audioFileL = event.data.audioFileL;
                this.audioFileR = event.data.audioFileR;
                this.audioFileIndex = 0;
            }
            if (event.data.type == 'play') {
                this.isPlaying = event.data.isPlaying;
            }
        };
    }
    process(_: Float32Array[][], outputs: Float32Array[][]) {
        const outputDataL: Float32Array = outputs[0][0];
        const outputDataR: Float32Array = outputs[0][1];
        if (this.isPlaying && this.audioFileL && this.audioFileR) {
            for (let i: number = 0; i < outputDataL.length; i++) {
                outputDataL[i] = this.audioFileL[this.audioFileIndex + i];
                outputDataR[i] = this.audioFileR[this.audioFileIndex + i];
            }
            this.audioFileIndex += outputDataL.length;
            if (this.audioFileIndex >= this.audioFileL.length) {
                this.audioFileIndex %= this.audioFileL.length;
            }
        } else if (this.isPlaying && this.audioFileL) { //mono
            for (let i: number = 0; i < outputDataL.length; i++) {
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
            type: 'render',
            displayOutput: outputDataL.slice(),
        });

        return true;
    }
}
registerProcessor('synth-processor', WorkletProcessor);