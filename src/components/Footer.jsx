export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        <a href="https://scai.world">Second Circuit – Association for digital freedom of thought</a>
      </p>
      <p>
        Sentences from Tatoeba (<a href="https://tatoeba.org">tatoeba.org</a>), CC BY 2.0 FR. Embedding model:{' '}
        <a href="https://huggingface.co/nvidia/Nemotron-3-Embed-1B-BF16">NVIDIA Nemotron-3-Embed-1B</a>, licensed
        under OpenMDW-1.1, quantised for the browser (
        <a href="https://huggingface.co/SCAI-NGO/nemotron-3-embed-1b-onnx-web">SCAI-NGO/nemotron-3-embed-1b-onnx-web</a>
        ). Everything runs in your browser; nothing you type is sent anywhere.
      </p>
      <p>
        Source code licensed under the{' '}
        <a href="https://github.com/symphonic-navigator/embed-demo">GNU Affero General Public License v3.0</a>.
      </p>
    </footer>
  )
}
