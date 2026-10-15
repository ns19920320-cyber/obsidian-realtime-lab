import {build} from 'esbuild';
await build({entryPoints:['src/plugin.ts'],outfile:'main.js',bundle:true,format:'cjs',platform:'browser',target:'es2022',external:['obsidian','@codemirror/state','@codemirror/view','@codemirror/language']});
