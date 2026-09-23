import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CountUp } from '../components/CountUp';
import { formatMoney, type Currency } from '../lib/money';

const CURRENCIES: { code: Currency; rate: [number, number, number, number] }[] = [
  // [min, max, step, default]
  { code: 'USD', rate: [20, 250, 5, 75] },
  { code: 'EUR', rate: [20, 250, 5, 70] },
  { code: 'GBP', rate: [15, 200, 5, 60] },
  { code: 'INR', rate: [500, 10000, 100, 2500] },
];

function Slider({ id, label, value, min, max, step, onChange, display }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="lp-slider">
      <div className="lp-slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="num">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
      />
    </div>
  );
}

export function Calculator() {
  const [cur, setCur] = useState(0);
  const c = CURRENCIES[cur];
  const [projects, setProjects] = useState(2);
  const [requests, setRequests] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [rate, setRate] = useState(c.rate[3]);

  const hoursPerYear = (projects * requests * minutes * 12) / 60;
  const yearly = Math.round(hoursPerYear * rate);
  const weeks = hoursPerYear / 40;
  const money = (n: number) => formatMoney(n, c.code);

  return (
    <section className="lp-section lp-calc" aria-labelledby="calc-title">
      <div className="lp-container lp-calc-grid">
        <div className="lp-calc-copy" data-reveal>
          <p className="eyebrow">Be honest with yourself</p>
          <h2 id="calc-title" className="serif lp-h2">
            How much are you <em className="pen">giving away?</em>
          </h2>
          <p className="lp-lede">Count only the small stuff: the “quick ones”, the “while you’re in there”s. The requests you did without mentioning money.</p>

          <div className="lp-sliders">
            <Slider id="c-projects" label="Fixed-price projects a month" value={projects} min={1} max={10} step={1} onChange={setProjects} display={String(projects)} />
            <Slider id="c-requests" label="Small unpaid requests per project" value={requests} min={1} max={12} step={1} onChange={setRequests} display={String(requests)} />
            <Slider
              id="c-minutes"
              label="Time each one really takes"
              value={minutes}
              min={15}
              max={240}
              step={15}
              onChange={setMinutes}
              display={minutes < 60 ? `${minutes} min` : `${minutes / 60}h`}
            />
            <Slider id="c-rate" label="Your hourly rate" value={rate} min={c.rate[0]} max={c.rate[1]} step={c.rate[2]} onChange={setRate} display={money(rate)} />
            <div className="lp-calc-currency" role="group" aria-label="Currency">
              {CURRENCIES.map((x, i) => (
                <button
                  key={x.code}
                  type="button"
                  aria-pressed={i === cur}
                  onClick={() => {
                    setCur(i);
                    setRate(x.rate[3]);
                  }}
                >
                  {x.code}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lp-calc-result" data-reveal>
          <span className="eyebrow">Given away every year</span>
          <span className="lp-calc-number serif">
            <CountUp value={yearly} format={money} duration={700} />
          </span>
          <p className="lp-calc-sub">
            That’s <strong className="num">{Math.round(hoursPerYear)} hours</strong>, or about <strong className="num">{weeks < 1 ? 'less than a week' : `${weeks.toFixed(1)} weeks`}</strong> of full-time work, done for free.
          </p>
          <div className="lp-calc-rule" />
          <p className="lp-calc-close">
            You don’t have to charge for all of it. But you should get to <em>decide</em>. Catch one request a month and Optileno has done its job.
          </p>
          <Link to="/app" className="btn btn-accent btn-lg">
            Start catching them <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
