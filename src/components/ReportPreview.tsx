import { SYMPTOM_LABELS, type DialysisSession, type DailyLimits, type SymptomType } from '@/lib/store';
import type { FoodRecord, SymptomRecord } from '@/lib/generateReportPdf';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface ReportPreviewProps {
  period: number;
  foods: FoodRecord[];
  symptoms: SymptomRecord[];
  sessions: DialysisSession[];
  limits: DailyLimits;
}

export default function ReportPreview({ period, foods, symptoms, sessions, limits }: ReportPreviewProps) {
  const now = new Date();
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (period - 1));

  const days = period;
  const totalK = foods.reduce((s, f) => s + Number(f.potassium_mg), 0);
  const totalP = foods.reduce((s, f) => s + Number(f.phosphate_mg), 0);
  const totalNa = foods.reduce((s, f) => s + Number(f.sodium_mg), 0);
  const totalPr = foods.reduce((s, f) => s + Number(f.protein_g), 0);
  const totalFl = foods.reduce((s, f) => s + Number(f.fluid_ml), 0);

  const byDate = new Map<string, FoodRecord[]>();
  foods.forEach(f => {
    const day = f.logged_at.split('T')[0];
    if (!byDate.has(day)) byDate.set(day, []);
    byDate.get(day)!.push(f);
  });

  const symptomCounts = new Map<string, { count: number; totalSeverity: number }>();
  symptoms.forEach(s => {
    const label = SYMPTOM_LABELS[s.symptom_name as SymptomType] || s.symptom_name;
    if (!symptomCounts.has(label)) symptomCounts.set(label, { count: 0, totalSeverity: 0 });
    const entry = symptomCounts.get(label)!;
    entry.count++;
    entry.totalSeverity += s.severity_score;
  });

  return (
    <div className="space-y-5 p-4 pb-8 text-sm text-foreground">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold">Dialyse Patiënt Rapport</h2>
        <p className="text-xs text-muted-foreground">
          Periode: {formatDate(startDate.toISOString())} – {formatDate(now.toISOString())}
        </p>
        <p className="text-xs text-muted-foreground">
          Gegenereerd: {formatDate(now.toISOString())} om {now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Limits */}
      <Section title="Ingestelde daglimieten">
        <Row label="Kalium" value={`${limits.potassium} mg`} />
        <Row label="Fosfaat" value={`${limits.phosphate} mg`} />
        <Row label="Natrium" value={`${limits.sodium} mg`} />
        <Row label="Eiwit" value={`${limits.protein} g`} />
        <Row label="Vocht" value={`${limits.fluid} ml`} />
      </Section>

      {/* Nutrition */}
      <Section title="Voedingsinname">
        {foods.length > 0 ? (
          <>
            <p className="font-semibold text-xs mb-1">Gemiddeld per dag:</p>
            <Row label="Kalium" value={`${Math.round(totalK / days)} mg`} sub={`limiet: ${limits.potassium} mg`} />
            <Row label="Fosfaat" value={`${Math.round(totalP / days)} mg`} sub={`limiet: ${limits.phosphate} mg`} />
            <Row label="Natrium" value={`${Math.round(totalNa / days)} mg`} sub={`limiet: ${limits.sodium} mg`} />
            <Row label="Eiwit" value={`${Math.round(totalPr / days)} g`} sub={`limiet: ${limits.protein} g`} />
            <Row label="Vocht" value={`${Math.round(totalFl / days)} ml`} sub={`limiet: ${limits.fluid} ml`} />
            <p className="text-xs text-muted-foreground mt-2">Totaal registraties: {foods.length}</p>

            <p className="font-semibold text-xs mt-3 mb-1">Per dag:</p>
            {Array.from(byDate.entries())
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, entries]) => {
                const dayK = entries.reduce((s, f) => s + Number(f.potassium_mg), 0);
                const dayP = entries.reduce((s, f) => s + Number(f.phosphate_mg), 0);
                const dayNa = entries.reduce((s, f) => s + Number(f.sodium_mg), 0);
                const dayFl = entries.reduce((s, f) => s + Number(f.fluid_ml), 0);
                return (
                  <div key={date} className="mt-2">
                    <p className="font-medium text-xs">
                      {formatDate(date + 'T00:00:00')}: K={dayK}mg P={dayP}mg Na={dayNa}mg Vocht={dayFl}ml
                    </p>
                    {entries.map(e => (
                      <p key={e.id} className="text-xs text-muted-foreground ml-3">• {e.name} ({e.portions}x)</p>
                    ))}
                  </div>
                );
              })}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Geen voedingsregistraties in deze periode.</p>
        )}
      </Section>

      {/* Symptoms */}
      <Section title="Symptomen">
        {symptoms.length > 0 ? (
          <>
            {Array.from(symptomCounts.entries()).map(([label, data]) => (
              <p key={label} className="text-xs">
                {label}: {data.count}x gemeld (gem. ernst: {(data.totalSeverity / data.count).toFixed(1)}/5)
              </p>
            ))}
            <p className="font-semibold text-xs mt-3 mb-1">Details:</p>
            {[...symptoms]
              .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
              .map(s => {
                const label = SYMPTOM_LABELS[s.symptom_name as SymptomType] || s.symptom_name;
                const stars = '●'.repeat(s.severity_score) + '○'.repeat(5 - s.severity_score);
                return (
                  <p key={s.id} className="text-xs ml-2">
                    {formatDate(s.logged_at)} – {label} [{stars}]{s.notes ? ` – ${s.notes}` : ''}
                  </p>
                );
              })}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Geen symptomen geregistreerd in deze periode.</p>
        )}
      </Section>

      {/* Dialysis */}
      {sessions.length > 0 && (
        <Section title="Dialyse sessies">
          <p className="text-xs">Aantal sessies: {sessions.length}</p>
          <p className="text-xs">
            Gem. vocht verwijderd: {Math.round(sessions.reduce((s, d) => s + d.fluidRemoved, 0) / sessions.length)} ml
          </p>
          {[...sessions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(s => {
              const wc = s.weightBefore - s.weightAfter;
              return (
                <div key={s.id} className="mt-2 ml-2">
                  <p className="font-medium text-xs">{formatDate(s.date + 'T00:00:00')} | {s.type}</p>
                  <p className="text-xs text-muted-foreground ml-2">Gewicht: {s.weightBefore}kg → {s.weightAfter}kg (−{wc.toFixed(1)}kg)</p>
                  <p className="text-xs text-muted-foreground ml-2">Vocht verwijderd: {s.fluidRemoved}ml</p>
                  {s.notes && <p className="text-xs text-muted-foreground ml-2">Notities: {s.notes}</p>}
                </div>
              );
            })}
        </Section>
      )}

      {/* Footer */}
      <div className="border-t pt-3 mt-4">
        <p className="text-[10px] text-muted-foreground">Gegenereerd met de Dialyse Inzicht app</p>
        <p className="text-[10px] text-muted-foreground">Dit rapport is bedoeld als hulpmiddel en vervangt geen medisch advies.</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold border-b border-primary/30 pb-1 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value}
        {sub && <span className="text-muted-foreground font-normal ml-1">({sub})</span>}
      </span>
    </div>
  );
}
