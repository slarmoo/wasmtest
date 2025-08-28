import { channelCount, loadPlugin, type PluginModule, type RenderContext, type TickContext } from "./wasmImport";

class WorkletProcessor extends AudioWorkletProcessor {
    private audioFileL: Float32Array | null = null;
    private audioFileR: Float32Array | null = null;
    private audioFileIndex: number = 0;
    private isPlaying: boolean = false;
    private pluginModule: PluginModule | undefined = undefined;

    constructor() {
        super();

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
                loadPlugin(event.data.wasmBytes)
                .then((plugin: PluginModule | undefined) => this.pluginModule = plugin)
                .then(() => {
                    
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

        //the mono/stereo stuff is a little jank the way I have this test set up, but it'll be better handled in beepbox
        if (this.pluginModule && this.isPlaying) {
            const tickContext: TickContext = {
                bpm: 150, //bpm and beat don't really exist in this context
                beat: 4,
                samplesPerTick: outputDataL.length //you could technically handle many render sizes, but here I'm only doing one
            }
            this.pluginModule.tick(tickContext);

            const renderContextL: RenderContext = {
                runLength: outputDataL.length,
                channelCount: channelCount.mono,
                samples: [outputDataL]
            }
            const renderContextR: RenderContext = {
                runLength: outputDataR.length,
                channelCount: channelCount.mono,
                samples: [outputDataR]
            }
            this.pluginModule.render(renderContextL);
            this.pluginModule.render(renderContextR);
        }

        this.port.postMessage({
            type: 'render',
            displayOutput: outputDataL.slice(),
        });

        return true;
    }
}
registerProcessor('synth-processor', WorkletProcessor);