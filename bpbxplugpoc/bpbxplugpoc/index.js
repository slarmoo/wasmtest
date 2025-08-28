const fs = require("node:fs");

const wasmBuffer = fs.readFileSync("plugin/build/corruption.wasm");

let HEAPU8;
let HEAPU32;
let HEAPU16;
let HEAPI8;
let HEAPI16;
let HEAPI32;
let HEAPF32;
let HEAPF64;

// Reads a C string from the module's memory.
// A C string contains ANSI or UTF8-encoded character data,
// terminated by a NUL character (char code 0).
const readCStr = (ptr) => {
	var buf = [];
	for (; HEAPU8[ptr] !== 0; ++ptr) {
		buf.push(HEAPU8[ptr]);
	}
	return String.fromCharCode(...buf);
};

const wasmImports = {
	bpbxplug: {
		log(str) {
			console.log(readCStr(str));
		}
	}
};

WebAssembly.instantiate(wasmBuffer, wasmImports).then(wasmModule => {
	const memory = wasmModule.instance.exports.memory;
	const funcTable = wasmModule.instance.exports.__indirect_function_table;
	const malloc = wasmModule.instance.exports.malloc;
	const free = wasmModule.instance.exports.free;
	
	// C ensures each integer type is memory-aligned
	// that is, 32-bit integers, which occupy 4 bytes, will only be placed in
	// addresses that are a multiple of 4. 16-bit integers, which occupy
	// 2 bytes, will only be placed in addresses that are a multple of 2,
	// e.t.c.
	// thus, to read a 32-bit integer from the HEAPI32 array, you read
	// from the index x/4, where x is the memory address.
	// right-shifting is faster and is the same as dividing by a power of 2.
	//   x >> 1 == x / 2
	//   x >> 2 == x / 4
	//   x >> 3 == x / 8
	// (or i guess you could just use a DataView)
	HEAPU8 = new Uint8Array(memory.buffer);
	HEAPU32 = new Uint32Array(memory.buffer);
	HEAPU16 = new Uint16Array(memory.buffer);
	HEAPI8 = new Int8Array(memory.buffer);
	HEAPI16 = new Int16Array(memory.buffer);
	HEAPI32 = new Int32Array(memory.buffer);
	HEAPF32 = new Float32Array(memory.buffer);
	HEAPF64 = new Float64Array(memory.buffer);
	
	{
		const initFunc = wasmModule.instance.exports._initialize;
		if (initFunc !== undefined)
			initFunc();
	}
	
	const moduleStruct = wasmModule.instance.exports.bpbxplug_entry();
	
	const moduleApiVersionStr = HEAPU32[moduleStruct >> 2];
	const apiVersion = readCStr(moduleApiVersionStr);

	console.log(apiVersion)
	if (apiVersion !== "0.0.1") {
		console.error("unsupported version " + apiVersion);
	}

	// malloc(sizeof(bpbxplug_plugin_s))
	// sizeof(bpbxplug_plugin_s) == 64
	const sizeOfPluginStruct = 64;
	let pluginInst = malloc(sizeOfPluginStruct);
	if (pluginInst === 0) {
		console.error("could not allocate plugin instance");

		// moduleStruct->destroy(pluginInst);
		funcTable.get(HEAPU32[(moduleStruct + 8)>>2])(pluginInst);
		return;
	}

	// zero-initialize pluginInst
	for (let i = 0; i < sizeOfPluginStruct; ++i) {
		HEAPU8[pluginInst + i] = 0;
	}

	const paramCount = 1;
	// pluginInst->paramCount = paramCount;
	HEAPU32[(pluginInst + 8) >> 2] = paramCount;

	// malloc(paramCount * sizeof(double))
	const paramData = malloc(paramCount * 8);
	if (paramData === 0) {
		console.error("could not allocate plugin instance");

		// moduleStruct->destroy(pluginInst);
		funcTable.get(HEAPU32[(moduleStruct + 8)>>2])(pluginInst);
		return;
	}

	// set all params to 0
	for (let i = 0; i < paramCount; ++i) {
		HEAPF64[(paramData>>3) + i] = 0;
	}

	// pluginInst->params = paramData
	HEAPU32[(pluginInst + 12)>>2] = paramData;

	// pluginInst->samples_per_second = 48khz
	HEAPF64[(pluginInst + 24)>>3] = 48000;

	// moduleStruct->init(pluginInst);
	funcTable.get(HEAPU32[(moduleStruct + 4)>>2])(pluginInst);

	


	// moduleStruct->destroy(pluginInst);
	funcTable.get(HEAPU32[(moduleStruct + 8)>>2])(pluginInst);
});