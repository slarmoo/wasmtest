#!/bin/bash
set -e

npx concurrently \
  "npx esbuild js/main.ts --format=iife --keep-names --bundle --outfile=main.js --sourcemap --watch " \
  "npx esbuild js/synth-processor.ts --format=iife --keep-names --bundle --outfile=synth-processor.js --sourcemap --watch " \
	"npx five-server --wait=200 --port=4001"