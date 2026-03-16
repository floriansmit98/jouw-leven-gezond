import { jsPDF } from 'jspdf';
import { SYMPTOM_LABELS, type DialysisSession, type DailyLimits, type SymptomType } from '@/lib/store';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface FoodRecord {
  id: string;
  name: string;
  potassium_mg: number;
  phosphate_mg: number;
  sodium_mg: number;
  protein_g: number;
  fluid_ml: number;
  portions: number;
  logged_at: string;
}

export interface SymptomRecord {
  id: string;
  symptom_name: string;
  severity_score: number;
  notes: string | null;
  logged_at: string;
}

export function generateReportPdf(
  period: number,
  foods: FoodRecord[],
  symptoms: SymptomRecord[],
  sessions: DialysisSession[],
  limits: DailyLimits,
): jsPDF {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const now = new Date();
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (period - 1));

  function checkPage(needed: number) {
    if (y + needed > 275) {
      pdf.addPage();
      y = 20;
    }
  }

  function heading(text: string) {
    checkPage(14);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(text, margin, y);
    y += 4;
    pdf.setDrawColor(60, 130, 180);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  function line(text: string, indent = 0) {
    checkPage(7);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(text, maxWidth - indent);
    lines.forEach((l: string) => {
      checkPage(6);
      pdf.text(l, margin + indent, y);
      y += 5;
    });
  }

  function bold(text: string, indent = 0) {
    checkPage(7);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(text, margin + indent, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
  }

  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40, 40, 40);
  pdf.text('Dialyse Rapport', margin, y);
  y += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Periode: ${formatDate(startDate.toISOString())} - ${formatDate(now.toISOString())}`,
    margin, y
  );
  y += 5;
  pdf.text(
    `Gegenereerd: ${formatDate(now.toISOString())} om ${now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
    margin, y
  );
  y += 10;
  pdf.setTextColor(40, 40, 40);

  // Limits
  heading('Ingestelde daglimieten');
  line(`Kalium: ${limits.potassium} mg`);
  line(`Fosfaat: ${limits.phosphate} mg`);
  line(`Natrium: ${limits.sodium} mg`);
  line(`Eiwit: ${limits.protein} g`);
  line(`Vocht: ${limits.fluid} ml`);
  y += 4;

  // Nutrition
  heading('Voedingsinname');
  if (foods.length > 0) {
    const totalK = foods.reduce((s, f) => s + Number(f.potassium_mg), 0);
    const totalP = foods.reduce((s, f) => s + Number(f.phosphate_mg), 0);
    const totalNa = foods.reduce((s, f) => s + Number(f.sodium_mg), 0);
    const totalPr = foods.reduce((s, f) => s + Number(f.protein_g), 0);
    const totalFl = foods.reduce((s, f) => s + Number(f.fluid_ml), 0);
    const days = period;

    bold('Gemiddeld per dag:');
    line(`Kalium: ${Math.round(totalK / days)} mg  (limiet: ${limits.potassium} mg)`);
    line(`Fosfaat: ${Math.round(totalP / days)} mg  (limiet: ${limits.phosphate} mg)`);
    line(`Natrium: ${Math.round(totalNa / days)} mg  (limiet: ${limits.sodium} mg)`);
    line(`Eiwit: ${Math.round(totalPr / days)} g  (limiet: ${limits.protein} g)`);
    line(`Vocht: ${Math.round(totalFl / days)} ml  (limiet: ${limits.fluid} ml)`);
    y += 3;
    line(`Totaal registraties: ${foods.length}`);
    y += 3;

    bold('Per dag:');
    const byDate = new Map<string, FoodRecord[]>();
    foods.forEach(f => {
      const day = f.logged_at.split('T')[0];
      if (!byDate.has(day)) byDate.set(day, []);
      byDate.get(day)!.push(f);
    });

    Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([date, entries]) => {
        const dayK = entries.reduce((s, f) => s + Number(f.potassium_mg), 0);
        const dayP = entries.reduce((s, f) => s + Number(f.phosphate_mg), 0);
        const dayNa = entries.reduce((s, f) => s + Number(f.sodium_mg), 0);
        const dayFl = entries.reduce((s, f) => s + Number(f.fluid_ml), 0);
        bold(`${formatDate(date + 'T00:00:00')}: K=${dayK}mg P=${dayP}mg Na=${dayNa}mg Vocht=${dayFl}ml`, 2);
        entries.forEach(e => line(`• ${e.name} (${e.portions}x)`, 6));
      });
  } else {
    line('Geen voedingsregistraties in deze periode.');
  }
  y += 4;

  // Symptoms
  heading('Symptomen');
  if (symptoms.length > 0) {
    const symptomCounts = new Map<string, { count: number; totalSeverity: number }>();
    symptoms.forEach(s => {
      const label = SYMPTOM_LABELS[s.symptom_name as SymptomType] || s.symptom_name;
      if (!symptomCounts.has(label)) symptomCounts.set(label, { count: 0, totalSeverity: 0 });
      const entry = symptomCounts.get(label)!;
      entry.count++;
      entry.totalSeverity += s.severity_score;
    });

    symptomCounts.forEach((data, label) => {
      const avg = (data.totalSeverity / data.count).toFixed(1);
      line(`${label}: ${data.count}x gemeld (gem. ernst: ${avg}/5)`);
    });
    y += 3;

    bold('Details:');
    [...symptoms]
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
      .forEach(s => {
        const label = SYMPTOM_LABELS[s.symptom_name as SymptomType] || s.symptom_name;
        const stars = '●'.repeat(s.severity_score) + '○'.repeat(5 - s.severity_score);
        line(`${formatDate(s.logged_at)} - ${label} [${stars}]${s.notes ? ` - ${s.notes}` : ''}`, 2);
      });
  } else {
    line('Geen symptomen geregistreerd in deze periode.');
  }
  y += 4;

  // Dialysis
  if (sessions.length > 0) {
    heading('Dialyse sessies');
    line(`Aantal sessies: ${sessions.length}`);
    const avgFl = sessions.reduce((s, d) => s + d.fluidRemoved, 0) / sessions.length;
    line(`Gem. vocht verwijderd: ${Math.round(avgFl)} ml`);
    y += 3;

    [...sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(s => {
        const wc = s.weightBefore - s.weightAfter;
        bold(`${formatDate(s.date + 'T00:00:00')} | ${s.type}`, 2);
        line(`Gewicht: ${s.weightBefore}kg → ${s.weightAfter}kg (−${wc.toFixed(1)}kg)`, 6);
        line(`Vocht verwijderd: ${s.fluidRemoved}ml`, 6);
        if (s.notes) line(`Notities: ${s.notes}`, 6);
      });
  }

  // Footer
  checkPage(20);
  y += 6;
  pdf.setDrawColor(180, 180, 180);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 6;
  pdf.setFontSize(8);
  pdf.setTextColor(140, 140, 140);
  pdf.text('Gegenereerd met de Dialyse Inzicht app', margin, y);
  y += 4;
  pdf.text('Dit rapport is bedoeld als hulpmiddel en vervangt geen medisch advies.', margin, y);

  return pdf;
}
