import { CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';

const phases = [
  {
    num: '01', title: 'Phase 1', icon: CheckCircle, color: 'emerald',
    target: 'Hor_C / Zone_1 / Segment 3',
    action: 'Appraisal-confirmed initial development',
    status: 'Most defensible first target',
    statusType: 'success',
  },
  {
    num: '02', title: 'Phase 2', icon: Clock, color: 'cyan',
    target: 'Hor_C Segments 1–2',
    action: 'Lateral expansion after appraisal',
    status: 'Expand after continuity confirmed',
    statusType: 'info',
  },
  {
    num: '03', title: 'Phase 3', icon: AlertCircle, color: 'amber',
    target: 'Hor_D / Zone_2 / Segment 2',
    action: 'Deep upside appraisal',
    status: 'High-side upside, not base case',
    statusType: 'warning',
  },
];

const flowSteps = [
  'tNavigator Static Model / Blocked Well Statistics',
  'Export X, Y, Z, property samples: PHIE, NTG, VSH, Netpay',
  'PEN-OPTIMA Variogram Assistant',
  'Recommended tNavigator input: main/normal/vertical range, sill, nugget',
  'Property Modeling QC → Volumetric Scenario Cockpit → Development Ranking',
];

export default function DevelopmentPlan() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Future Development Plan</h1>
        <p className="text-sm text-slate-400 mt-0.5">Phased appraisal and development strategy for Penobscot field</p>
      </div>

      <div className="info-box">
        <strong className="text-cyan">PEN-OPTIMA Concept:</strong> A digital decision-support dashboard integrating well-log interpretation, static model outputs, volumetric scenarios, variogram QC, zone–segment ranking, and future production surveillance — all in a single coherent interface.
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-3 gap-4">
        {phases.map((p) => {
          const colorMap = {
            emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', num: 'text-emerald-500/30', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
            cyan:    { bg: 'bg-cyan/5',         border: 'border-cyan/20',         text: 'text-cyan',         num: 'text-cyan/20',         badge: 'bg-cyan/10 text-cyan border-cyan/30' },
            amber:   { bg: 'bg-amber-500/5',    border: 'border-amber-500/20',    text: 'text-amber-400',    num: 'text-amber-500/20',    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
          }[p.color];
          const Icon = p.icon;

          return (
            <div key={p.num} className={`card ${colorMap.bg} border ${colorMap.border} relative overflow-hidden`}>
              <div className={`absolute top-3 right-4 text-6xl font-black ${colorMap.num} select-none`}>{p.num}</div>
              <div className="relative z-10">
                <div className={`flex items-center gap-2 mb-4`}>
                  <Icon size={18} className={colorMap.text} />
                  <span className={`font-bold text-base ${colorMap.text}`}>{p.title}</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Target</div>
                    <div className="text-white font-semibold">{p.target}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Action</div>
                    <div className="text-slate-300">{p.action}</div>
                  </div>
                  <span className={`inline-block text-xs px-3 py-1 rounded-full border ${colorMap.badge}`}>{p.status}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Innovation section */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center">
            <Zap size={15} className="text-cyan" />
          </div>
          <h2 className="text-base font-bold text-white">Innovation: Variogram Parameter Assistant</h2>
        </div>
        <p className="text-sm text-slate-300 mb-5">
          The variogram assistant reduces trial-and-error in tNavigator property modeling by recommending first-pass <strong className="text-cyan">range, sill, nugget, and variance</strong> for main, normal, and vertical directions — helping justify grid-property continuity assumptions before volumetric calculation.
        </p>

        <div className="bg-navy-900 rounded-xl border border-slate-700/50 p-5 font-mono text-xs">
          {flowSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0 ${i < 2 ? 'bg-slate-700 border-slate-600 text-slate-400' : i === 2 ? 'bg-cyan/20 border-cyan/50 text-cyan' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                  {i + 1}
                </div>
                {i < flowSteps.length - 1 && <div className="w-px h-6 bg-slate-700 mt-1" />}
              </div>
              <div className={`pb-3 ${i === 2 ? 'text-cyan font-semibold' : i > 2 ? 'text-emerald-400' : 'text-slate-400'}`}>{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk matrix */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Risk & Uncertainty Summary</h2>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { label: 'Volume Risk', level: 'Medium', detail: 'OWC uncertainty dominates; Hor_D adds upside' },
            { label: 'Reservoir Quality', level: 'Low-Med', detail: 'Zone_1 has good log evidence; Zone_2 uncertain' },
            { label: 'Structural Risk', level: 'Low', detail: 'Penobscot structure well-defined seismically' },
            { label: 'Development Risk', level: 'Low-Med', detail: 'Seg 3 is closest to proven accumulation center' },
            { label: 'Recovery Factor', level: 'Medium', detail: 'RF range 20–40%; base 30% is industry-typical' },
            { label: 'Overall Confidence', level: 'Medium', detail: 'Hor_C base case is most defensible scenario' },
          ].map((r, i) => (
            <div key={i} className="bg-navy-900 border border-slate-700/50 rounded-xl p-3">
              <div className="text-slate-400 mb-1">{r.label}</div>
              <div className={`font-bold mb-1.5 ${r.level === 'Low' ? 'text-emerald-400' : r.level === 'Medium' ? 'text-amber-400' : 'text-orange-400'}`}>{r.level}</div>
              <div className="text-slate-500 leading-relaxed">{r.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
