import CosineTriangle from './explainer/CosineTriangle.jsx'
import KingQueenSketch from './explainer/KingQueenSketch.jsx'
import PcaMap from './explainer/PcaMap.jsx'

export default function Explainer({ onOpenPlayground }) {
  return (
    <div className="explainer">
      <section>
        <h2>What is an embedding?</h2>
        <p>
          An embedding model is a neural network, much like the large language models (LLMs) behind chatbots. The
          difference is what it was trained to do: an LLM learns to <em>write</em> text, while an embedding model
          learns to capture what a text <em>means</em>.
        </p>
        <p>
          You give it a sentence or a paragraph, and it gives back a long list of numbers: a point in a space with
          2048 dimensions. Texts with similar meanings land close together; unrelated texts land far apart. No single
          number stands for anything you could name. Only the positions relative to each other matter.
        </p>
        <p>
          This app uses <strong>NVIDIA Nemotron-3-Embed-1B</strong>, and it runs entirely in your browser.
        </p>
      </section>

      <section>
        <h2>The classic: king − man + woman ≈ queen</h2>
        <p>
          In 2013, a model called <strong>word2vec</strong> made headlines. It gave every word one fixed vector, and
          people found that the arrows between words carried meaning: the step from “man” to “woman” was roughly the
          same as the step from “king” to “queen”. So king − man + woman landed near queen.
        </p>
        <div className="figure">
          <KingQueenSketch />
          <p className="caption">
            A drawn sketch of the idea, not computed: the “female” arrows are parallel, and so are the “royal” ones.
          </p>
        </div>
        <p className="note">
          This is history, and a lovely picture, but don’t expect it from modern sentence models like the one here.
          They do not have one vector per word, and this kind of arithmetic does not reliably work with them.
        </p>
      </section>

      <section>
        <h2>Meaning depends on context</h2>
        <p>
          One fixed vector per word has a problem. Take “bank”: it can be a building full of money, the bank of a
          river, and in German a <em>Bank</em> is also a bench in the park. Word2vec had to squeeze all of these into
          one point.
        </p>
        <ul>
          <li>“I paid the money in at the bank.”</li>
          <li>“We had a picnic on the bank of the river.”</li>
          <li>“Wir saßen auf einer Bank im Park.” (We sat on a bench in the park.)</li>
        </ul>
        <p>
          Modern models read the whole text at once, so the surrounding words decide which “bank” is meant. That is
          why they embed whole phrases and passages, often called <strong>chunks</strong>, rather than isolated
          words.
        </p>
      </section>

      <section>
        <h2>Across languages</h2>
        <p>
          This model was trained on many languages. Below are four sentences, each written in Japanese, French,
          German and English, embedded and then squashed down from 2048 dimensions to two so we can draw them.
        </p>
        <PcaMap />
        <p>
          The Japanese sentence about rain sits next to the French one about rain, not next to the Japanese one about
          coffee. That is what makes searching across languages possible: a French query can find a Japanese text.
        </p>
      </section>

      <section>
        <h2>Measuring similarity: the cosine</h2>
        <p>
          To compare two texts, we look at the angle between their vectors. The smaller the angle, the more similar
          the meaning. The number we use is the <strong>cosine</strong> of that angle. In a right-angled triangle
          whose long side (the hypotenuse) has length 1, the cosine is simply the length of the side next to the
          angle: cos = adjacent ÷ hypotenuse.
        </p>
        <CosineTriangle />
        <p>
          Why not just measure the straight-line (Pythagorean, or Euclidean) distance between the points? For
          vectors of length 1, which is what this model produces, the two are tied together: distance² = 2 − 2·cos.
          So both give exactly the same ranking. The cosine is preferred because it measures <em>direction</em> and
          ignores length, and because it is easy to read: 1 means the same direction, 0 means unrelated.
        </p>
        <h3>Why is nothing ever close to 0°?</h3>
        <p>
          With this model, real similarities mostly sit around 0.1 to 0.5, so the points cluster at roughly 60° to
          85°. Even a very good match rarely gets near 1. There are two reasons: all texts share a lot (they are all
          human language), and queries and passages are embedded with different prefixes (“query:” and
          “passage:”), so a question and its answer never point in exactly the same direction.
        </p>
        <p>What matters is the order, not the absolute value. A 0.45 is a strong hit if everything else is 0.2.</p>
        {onOpenPlayground ? (
          <button className="secondary" onClick={onOpenPlayground}>
            Try it in the Playground: the angle fan
          </button>
        ) : (
          <p className="muted">The Playground opens once the model has loaded.</p>
        )}
      </section>

      <section>
        <h2>Top-k, top-p and temperature</h2>
        <p>
          A search gives every text a similarity score. Then we have to decide how many results to keep. Think of a
          school with several year groups, where pupils compete for places.
        </p>
        <p>
          <strong>Top-k</strong> is “only the top 10 of each year group get a place”. It depends on rank only: the
          10th is in, the 11th is out, however close their scores were.
        </p>
        <p>
          <strong>Top-p</strong> is “admit the best until together they hold 80 % of all the points”. A clear-cut
          year, with a few stars far ahead, admits few. A close year, where everyone scored much the same, admits
          many. It is the same mechanism as top-p sampling in LLMs, where it decides which next words are allowed.
        </p>
        <p>
          To get those “points”, the similarities are turned into shares that add up to 100 % with a softmax, after
          dividing each similarity by a <strong>temperature</strong> T. This matters because raw cosines sit close
          together: 0.45, 0.40 and 0.30 become shares of about 36 %, 34 % and 31 %, nearly flat, so top-p would hardly
          filter anything. With T = 0.05 the same three become about 70 %, 26 % and 4 %.
        </p>
        <ul>
          <li>Low temperature: the winner takes almost all.</li>
          <li>High temperature: everyone is nearly equal.</li>
        </ul>
        <p>
          In the Playground, every text stays in the list. Those that do not make the cut are greyed out with the
          reason: “k too low”, “p too low” or “k and p too low”. A k line and a p line show where each cut falls,
          and they move as you drag the sliders.
        </p>
      </section>

      <section>
        <h2>When is this the right tool, and where are the limits?</h2>
        <p>Embeddings shine whenever you want to find things by what they mean rather than by the exact words:</p>
        <ul>
          <li>
            <strong>Search by meaning:</strong> “my laptop won’t turn on” finds the help article titled “Power
            problems”, even though they share no words.
          </li>
          <li>
            <strong>Duplicate detection:</strong> spot the same question asked twice in different words, or the same
            bug reported in three languages.
          </li>
          <li>
            <strong>Recommendations:</strong> “people who read this might like that”, based on content rather than
            clicks.
          </li>
          <li>
            <strong>RAG (retrieval-augmented generation):</strong> find the few passages that fit a question and hand
            them to an LLM, so it answers from your documents rather than from memory.
          </li>
        </ul>
        <p>But an embedding measures “sounds alike in meaning”, not “says the same thing”. Watch out for:</p>
        <ul>
          <li>
            <strong>Negation:</strong> “I like cats” and “I don’t like cats” land close together. They are about the
            same topic, and the one small word that flips the meaning barely moves the point.
          </li>
          <li>
            <strong>Irony and sarcasm:</strong> “Oh great, another Monday” is embedded much like real enthusiasm.
          </li>
          <li>
            <strong>Similar is not true:</strong> a confident wrong answer can sit right next to the question. A
            search finds what fits, not what is correct, so check the sources before you trust them.
          </li>
          <li>
            <strong>Length:</strong> one vector for a whole novel says little; it becomes a blurry average of
            everything in it. Real systems cut long documents into chunks of a few sentences or paragraphs and embed
            each one.
          </li>
        </ul>
        <p className="note">
          A good rule of thumb: use embeddings to <em>find candidates</em>, then let a person, or a more careful
          step, decide what is right. Try a sentence and its negation in the Playground and see how close they land.
        </p>
      </section>
    </div>
  )
}
