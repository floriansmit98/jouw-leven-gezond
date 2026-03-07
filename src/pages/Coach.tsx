import { useState, useRef, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User } from 'lucide-react';
import { getTodayTotals, getLimits, getStatusLabel, getStatusColor } from '@/lib/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Local AI coach with pre-built responses (no backend needed yet)
function getCoachResponse(question: string): string {
  const q = question.toLowerCase();
  const totals = getTodayTotals();
  const limits = getLimits();

  if (q.includes('banaan')) {
    return 'Bananen bevatten veel kalium (ongeveer 360 mg per stuk). Voor dialysepatiënten is het beter om een halve banaan te eten of te kiezen voor fruit met minder kalium, zoals een appel of peer.';
  }
  if (q.includes('dorst') || q.includes('drinken')) {
    return 'Tips tegen dorst na dialyse:\n\n• Zuig op een ijsblokje\n• Spoel uw mond met koud water\n• Kauw op suikervrije kauwgom\n• Eet een stukje bevroren fruit\n• Vermijd zoute snacks\n\nUw huidige vochtinname vandaag: ' + totals.fluid + ' ml van ' + limits.fluid + ' ml.';
  }
  if (q.includes('eten') && (q.includes('avond') || q.includes('vanavond'))) {
    return 'Goede opties voor het avondeten:\n\n• Kip met rijst en courgette\n• Pasta met roomsaus en paprika\n• Witvis met aardappelpuree (kleine portie)\n\nVermijd voedingsmiddelen met veel kalium zoals tomaten, bananen en noten.';
  }
  if (q.includes('kalium') || q.includes('potassium')) {
    const status = getStatusColor(totals.potassium, limits.potassium);
    return `Uw kaliuminname vandaag is ${totals.potassium} mg van ${limits.potassium} mg (${getStatusLabel(status)}).\n\nVoedingsmiddelen met veel kalium om te vermijden:\n• Bananen\n• Tomaten\n• Aardappelen (weken in water helpt)\n• Chocolade\n• Noten`;
  }
  if (q.includes('fosfaat') || q.includes('phosph')) {
    return 'Fosfaat tips:\n\n• Vermijd zuivelproducten in grote hoeveelheden\n• Kies voor rijst in plaats van volkoren\n• Neem uw fosfaatbinders in bij de maaltijd\n• Vermijd cola en bewerkt voedsel';
  }
  if (q.includes('moe') || q.includes('vermoeid')) {
    return 'Vermoeidheid is heel normaal bij dialyse. Tips:\n\n• Rust voldoende uit, vooral na dialyse\n• Beweeg licht (wandelen)\n• Eet voldoende eiwitten\n• Bespreek bloedarmoede met uw arts\n\nAls u zich steeds vermoeider voelt, neem contact op met uw nefroloog.';
  }
  if (q.includes('gewicht')) {
    return 'Probeer uw gewichtstoename tussen dialyse sessies onder de 2 kg te houden. Tips:\n\n• Verdeel uw vochtinname over de dag\n• Vermijd zoute snacks\n• Gebruik het vochtschema op het dashboard';
  }

  return `Bedankt voor uw vraag! Als dialyse coach kan ik u helpen met:\n\n• Voedingsadvies (kalium, fosfaat, natrium, eiwit)\n• Tips tegen dorst\n• Informatie over symptomen\n• Wat u kunt eten\n\nUw dagelijkse status:\n• Kalium: ${totals.potassium}/${limits.potassium} mg\n• Fosfaat: ${totals.phosphate}/${limits.phosphate} mg\n• Eiwit: ${totals.protein}/${limits.protein} g\n• Vocht: ${totals.fluid}/${limits.fluid} ml\n\nStel gerust een specifieke vraag!`;
}

export default function Coach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hallo! Ik ben uw Dialyse Coach. Ik kan u helpen met vragen over voeding, symptomen en uw dagelijkse gezondheid. Wat wilt u weten?',
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const response = getCoachResponse(input.trim());
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: response }]);
    setInput('');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <div className="mx-auto w-full max-w-lg px-4 pt-6">
        <PageHeader title="Dialyse Coach" mascotMood="thinking" mascotMessage="Stel mij uw vragen over dieet en gezondheid." />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="mx-auto max-w-lg space-y-4 pb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                msg.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}>
                {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'assistant'
                  ? 'bg-card border border-border text-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}>
                {msg.content.split('\n').map((line, j) => (
                  <p key={j} className={j > 0 ? 'mt-1' : ''}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-16 left-0 right-0 border-t border-border bg-card p-3">
        <div className="mx-auto flex max-w-lg gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Stel een vraag..."
            className="h-12 rounded-xl text-base"
          />
          <Button onClick={handleSend} className="h-12 w-12 shrink-0 rounded-xl p-0">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
