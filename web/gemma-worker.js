// Gemma 4 E2B in the player's browser (Transformers.js + WebGPU), off the main thread.
import { AutoProcessor, Gemma4ForConditionalGeneration } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.web.min.js";

const MODEL = "onnx-community/gemma-4-E2B-it-ONNX";
let processor = null, model = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      processor = await AutoProcessor.from_pretrained(MODEL);
      model = await Gemma4ForConditionalGeneration.from_pretrained(MODEL, {
        dtype: "q4f16", device: "webgpu",
        progress_callback: (p) => { if (p.status === "progress_total") self.postMessage({ type: "progress", value: p.progress }); },
      });
      self.postMessage({ type: "ready" });
    } else if (data.type === "generate") {
      const messages = data.messages.map((m) => ({ role: m.role, content: [{ type: "text", text: m.content }] }));
      const prompt = processor.apply_chat_template(messages, { enable_thinking: false, add_generation_prompt: true });
      const inputs = await processor(prompt, null, null, { add_special_tokens: false });
      const out = await model.generate({ ...inputs, max_new_tokens: 160, do_sample: true, temperature: 0.6, top_p: 0.95 });
      const n = inputs.input_ids.dims.at(-1);
      const [text] = processor.batch_decode(out.slice(null, [n, null]), { skip_special_tokens: true });
      self.postMessage({ type: "result", id: data.id, text });
    }
  } catch (e) {
    self.postMessage({ type: "error", id: data.id, message: String(e?.message || e) });
  }
};
