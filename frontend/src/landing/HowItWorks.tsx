import { ComposerMock, ReplyMock, ScopeMock } from './mockups';

const STEPS = [
  {
    n: '1',
    title: 'Draw the lines, in a minute.',
    body: 'Pick what you’re making (a website, a logo, a video edit) and Optileno fills in a careful scope: the deliverables, the revision rounds, and, most importantly, what’s not included. Change anything.',
    note: 'Six starting templates, written the way careful freelancers write proposals.',
    mock: <ScopeMock />,
  },
  {
    n: '2',
    title: 'Paste what they asked.',
    body: 'When a request lands in your inbox or Slack, paste it in. Optileno reads it against the scope and tells you what it is: in scope, a revision round, or extra. It always shows its reasoning. You make the call.',
    note: 'No AI guessing, no contract uploads. Plain rules that run on your device.',
    mock: <ComposerMock />,
  },
  {
    n: '3',
    title: 'Charge it, or gift it.',
    body: 'Extras are priced from your rate in two taps, with the new delivery date worked out. Optileno drafts a reply that sounds like you, warm or brief, with a link your client can approve in one tap.',
    note: 'Gifts are logged too, and shown to your client with their value.',
    mock: <ReplyMock />,
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="lp-section lp-how" aria-labelledby="how-title">
      <div className="lp-container">
        <header className="lp-section-head" data-reveal>
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="serif lp-h2">
            Three moves. <em className="pen">No awkward conversations.</em>
          </h2>
        </header>
        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="lp-step" data-reveal>
              <div className="lp-step-text">
                <span className="lp-step-n serif" aria-hidden="true">
                  {s.n}
                </span>
                <h3 className="serif lp-h3">{s.title}</h3>
                <p className="lp-body">{s.body}</p>
                <p className="lp-step-note">{s.note}</p>
              </div>
              <div className="lp-step-mock">{s.mock}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
