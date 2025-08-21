#!/bin/bash
set -e

npx concurrently \
  "npx esbuild src/main.ts --format=iife --keep-names --bundle --outfile=main.js --sourcemap --watch " \
  "npx esbuild src/synth-processor.ts --format=iife --keep-names --bundle --outfile=synth-processor.js --sourcemap --watch " \
	"npx five-server --wait=200 --watch=website --port=4001"