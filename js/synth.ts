import { ResizeableBuffer } from "./resizableBuffer";

export class Synth {
    public isPlaying: boolean = false;
    private initialized: boolean = false;

    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;

    //visuals
    private displayOutput: ResizeableBuffer | null = null;
    public bufferSize: number = Math.pow(2, 11);
    public display: Float32Array | null = null;

    public async initializeFileData(data: ArrayBuffer) {
        await this.activate();
        const buffer: AudioBuffer = await this.audioContext!.decodeAudioData(data);

        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'initialize',
                audioFileL: buffer.getChannelData(0),
                audioFileR: buffer.getChannelData(1),
            }, );
            this.initialized = true;
        }

        fetch("./bpbxplugpoc/bpbxplugpoc/plugin/build/corruption.wasm")
        .then((wasm) => wasm.arrayBuffer())
        .then((wasmBytes) => {
            if (this.workletNode) {
                this.workletNode.port.postMessage({
                    type: 'plugin',
                    wasmBytes: wasmBytes
                }, [wasmBytes]);
            }
        })
        
        if (!this.isPlaying) {
            this.togglePause();
        }
    }

    public togglePause() {
        this.isPlaying = !this.isPlaying && this.initialized;
        if (this.isPlaying) {
            this.activate();
            
        }
        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'play',
                isPlaying: this.isPlaying,
        });
        }
    }

    private async activate() {
        if (this.audioContext == null || this.workletNode == null) {
            const latencyHint: AudioContextLatencyCategory = "balanced";
            this.audioContext = this.audioContext || new AudioContext({ latencyHint: latencyHint });

            await this.audioContext.audioWorklet.addModule("synth-processor.js");
            this.workletNode = new AudioWorkletNode(this.audioContext, 'synth-processor', {numberOfOutputs: 1, outputChannelCount: [2]});
            
            this.workletNode.connect(this.audioContext.destination);
            this.workletNode.port.onmessage = (event) => {
                if (event.data.type == 'render') {
                    if (this.displayOutput == null) { 
                        this.displayOutput = new ResizeableBuffer(undefined, this.bufferSize);
                    } else if (this.displayOutput != null && this.displayOutput.length() < this.bufferSize) {
                        this.displayOutput.concat(event.data.displayOutput);
                    } else {
                        this.displayOutput.clear();
                        this.displayOutput.concat(event.data.displayOutput);
                    }
                    if (this.displayOutput.length() == this.bufferSize) {
                        this.display = this.displayOutput.getBuffer();
                    }
                }
            }
        }
        await this.audioContext.resume();
    }
}