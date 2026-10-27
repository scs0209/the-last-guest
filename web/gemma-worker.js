// Gemma 4 E2B in the player's browser (Transformers.js + WebGPU), off the main thread.
// Text only: loads the embeddings and decoder, not the vision and audio encoders (about 3.1 GB, cached after the first visit).
// jsDelivr's +esm build bundles onnxruntime-web, so the worker needs no import map.
import { AutoTokenizer, Gemma4ForCausalLM } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/+esm";

const MODEL = "onnx-community/gemma-4-E2B-it-ONNX";
let tokenizer = null, model = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      tokenizer = await AutoTokenizer.from_pretrained(MODEL);
      model = await Gemma4ForCausalLM.from_pretrained(MODEL, {
        dtype: "q4f16", device: "webgpu",
        progress_callback: (p) => { if (p.status === "progress_total") self.postMessage({ type: "progress", value: p.progress }); },
      });
      self.postMessage({ type: "ready" });
    } else if (data.type === "generate") {
      const inputs = tokenizer.apply_chat_template(data.messages, { add_generation_prompt: true, enable_thinking: false, return_dict: true });
      const out = await model.generate({ ...inputs, max_new_tokens: 160, do_sample: true, temperature: 0.6, top_p: 0.95 });
      const n = inputs.input_ids.dims.at(-1);
      const [text] = tokenizer.batch_decode(out.slice(null, [n, null]), { skip_special_tokens: true });
      self.postMessage({ type: "result", id: data.id, text });
    }
  } catch (e) {
    self.postMessage({ type: "error", id: data.id, message: String(e?.message || e) });
  }
};
