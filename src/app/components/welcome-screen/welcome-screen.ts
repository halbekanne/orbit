import { ChangeDetectionStrategy, Component, output, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-welcome-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: 'position:fixed;inset:0;z-index:50;display:block',
  },
  encapsulation: ViewEncapsulation.None,
  styles: [`
    @keyframes orbit-twinkle { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
    @keyframes orbit-fade-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
    @keyframes orbit-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes orbit-planet-pulse {
      0%, 100% { box-shadow: 0 0 30px rgba(167,139,250,0.3), 0 0 60px rgba(124,58,237,0.12); }
      50% { box-shadow: 0 0 40px rgba(167,139,250,0.4), 0 0 80px rgba(124,58,237,0.18); }
    }
    @keyframes orbit-1 { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
    @keyframes orbit-2 { from { transform: translate(-50%,-50%) rotate(60deg); } to { transform: translate(-50%,-50%) rotate(420deg); } }
    @keyframes orbit-3 { from { transform: translate(-50%,-50%) rotate(180deg); } to { transform: translate(-50%,-50%) rotate(540deg); } }
  `],
  template: `
    <div class="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto"
         style="background:
           #0c0a09;
           ">
      <!-- Gradient overlays -->
      <div class="absolute inset-0 pointer-events-none"
           style="background: radial-gradient(ellipse 100% 80% at 50% 30%, rgba(124,58,237,0.18) 0%, rgba(91,33,182,0.08) 35%, transparent 65%)"></div>
      <div class="absolute inset-0 pointer-events-none"
           style="background: radial-gradient(ellipse 60% 50% at 20% 60%, rgba(124,58,237,0.06) 0%, transparent 60%)"></div>
      <div class="absolute inset-0 pointer-events-none"
           style="background: radial-gradient(ellipse 50% 40% at 80% 70%, rgba(91,33,182,0.05) 0%, transparent 55%)"></div>

      <!-- Starfield -->
      <div class="absolute inset-0 pointer-events-none"
           style="animation: orbit-twinkle 12s ease-in-out infinite alternate;
                  background:
                    radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.5), transparent),
                    radial-gradient(1.2px 1.2px at 25% 8%, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 40% 22%, rgba(255,255,255,0.35), transparent),
                    radial-gradient(1.5px 1.5px at 55% 5%, rgba(255,255,255,0.45), transparent),
                    radial-gradient(1px 1px at 70% 18%, rgba(255,255,255,0.3), transparent),
                    radial-gradient(1.2px 1.2px at 85% 12%, rgba(255,255,255,0.5), transparent),
                    radial-gradient(1px 1px at 92% 25%, rgba(255,255,255,0.35), transparent),
                    radial-gradient(1.5px 1.5px at 5% 35%, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 18% 42%, rgba(255,255,255,0.3), transparent),
                    radial-gradient(1.2px 1.2px at 33% 38%, rgba(255,255,255,0.45), transparent),
                    radial-gradient(1px 1px at 48% 45%, rgba(255,255,255,0.35), transparent),
                    radial-gradient(1.5px 1.5px at 62% 32%, rgba(255,255,255,0.5), transparent),
                    radial-gradient(1px 1px at 78% 40%, rgba(255,255,255,0.3), transparent),
                    radial-gradient(1.2px 1.2px at 88% 35%, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 95% 48%, rgba(255,255,255,0.35), transparent),
                    radial-gradient(1.5px 1.5px at 8% 55%, rgba(255,255,255,0.45), transparent),
                    radial-gradient(1px 1px at 22% 62%, rgba(255,255,255,0.3), transparent),
                    radial-gradient(1.2px 1.2px at 38% 58%, rgba(255,255,255,0.5), transparent),
                    radial-gradient(1px 1px at 52% 65%, rgba(255,255,255,0.35), transparent),
                    radial-gradient(1.5px 1.5px at 68% 52%, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 82% 60%, rgba(255,255,255,0.3), transparent),
                    radial-gradient(1.2px 1.2px at 15% 75%, rgba(255,255,255,0.45), transparent),
                    radial-gradient(1px 1px at 30% 82%, rgba(255,255,255,0.35), transparent),
                    radial-gradient(1.5px 1.5px at 45% 78%, rgba(255,255,255,0.5), transparent),
                    radial-gradient(1px 1px at 60% 85%, rgba(255,255,255,0.3), transparent),
                    radial-gradient(1.2px 1.2px at 75% 72%, rgba(255,255,255,0.4), transparent),
                    radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.35), transparent),
                    radial-gradient(1.5px 1.5px at 3% 88%, rgba(255,255,255,0.45), transparent),
                    radial-gradient(1px 1px at 50% 92%, rgba(255,255,255,0.3), transparent),
                    radial-gradient(1.2px 1.2px at 97% 90%, rgba(255,255,255,0.5), transparent)
                  "></div>

      <!-- Orbit illustration -->
      <div class="relative shrink-0"
           style="width: 260px; height: 260px; animation: orbit-fade-in 1.2s ease-out both">

        <!-- Ring 3 (outermost) -->
        <div class="absolute rounded-full"
             style="width: 258px; height: 258px; top: 50%; left: 50%; transform: translate(-50%,-50%);
                    border: 1px dashed rgba(120,113,108,0.08)"></div>

        <!-- Ring 2 -->
        <div class="absolute rounded-full"
             style="width: 210px; height: 210px; top: 50%; left: 50%; transform: translate(-50%,-50%);
                    border: 1px solid rgba(167,139,250,0.1)"></div>

        <!-- Ring 1 -->
        <div class="absolute rounded-full"
             style="width: 140px; height: 140px; top: 50%; left: 50%; transform: translate(-50%,-50%);
                    border: 1px dashed rgba(167,139,250,0.18)"></div>

        <!-- Planet -->
        <div class="absolute rounded-full"
             style="width: 56px; height: 56px; top: 50%; left: 50%; transform: translate(-50%,-50%);
                    background: radial-gradient(circle at 35% 35%, #c4b5fd 0%, #7c3aed 40%, #3b0764 100%);
                    animation: orbit-planet-pulse 6s ease-in-out infinite">
          <div class="absolute rounded-full"
               style="width: 22px; height: 14px; top: 12px; left: 10px;
                      background: radial-gradient(ellipse, rgba(255,255,255,0.3) 0%, transparent 70%)"></div>
        </div>

        <!-- Satellite 1 on Ring 1 (12s orbit) -->
        <div class="absolute"
             style="width: 140px; height: 140px; top: 50%; left: 50%;
                    animation: orbit-1 12s linear infinite">
          <div class="absolute rounded-full"
               style="width: 18px; height: 18px; top: -9px; left: 50%; transform: translateX(-50%);
                      background: radial-gradient(circle at 35% 35%, #d6d3d1 0%, #78716c 100%);
                      box-shadow: 0 0 10px rgba(167,139,250,0.4)"></div>
        </div>

        <!-- Satellite 2 on Ring 2 (20s orbit, starts 60deg) -->
        <div class="absolute"
             style="width: 210px; height: 210px; top: 50%; left: 50%;
                    animation: orbit-2 20s linear infinite">
          <div class="absolute rounded-full"
               style="width: 10px; height: 10px; top: -5px; left: 50%; transform: translateX(-50%);
                      background: radial-gradient(circle at 35% 35%, #c4b5fd 0%, #7c3aed 100%);
                      box-shadow: 0 0 6px rgba(167,139,250,0.3)"></div>
        </div>

        <!-- Satellite 3 on Ring 3 (30s orbit, reverse) -->
        <div class="absolute"
             style="width: 258px; height: 258px; top: 50%; left: 50%;
                    animation: orbit-3 30s linear infinite reverse">
          <div class="absolute rounded-full"
               style="width: 6px; height: 6px; top: -3px; left: 50%; transform: translateX(-50%);
                      background: radial-gradient(circle at 35% 35%, #a8a29e 0%, #78716c 100%)"></div>
        </div>

        <!-- Decorative dots -->
        <div class="absolute rounded-full" style="width: 3px; height: 3px; top: 20px; left: 30px; background: rgba(167,139,250,0.25)"></div>
        <div class="absolute rounded-full" style="width: 4px; height: 4px; top: 200px; left: 220px; background: rgba(120,113,108,0.2)"></div>
        <div class="absolute rounded-full" style="width: 3px; height: 3px; top: 80px; left: 230px; background: rgba(167,139,250,0.2)"></div>
        <div class="absolute rounded-full" style="width: 4px; height: 4px; top: 180px; left: 20px; background: rgba(120,113,108,0.15)"></div>
      </div>

      <!-- Text content -->
      <div class="flex flex-col items-center text-center mt-8" style="max-width: 440px">
        <!-- Title -->
        <h1 style="font-family: 'Nunito', sans-serif; font-size: 30px; font-weight: 800;
                    animation: orbit-fade-up 0.8s ease-out both; animation-delay: 0.3s; opacity: 0">
          <span style="color: #e7e5e4">Willkommen bei </span>
          <span style="background: linear-gradient(135deg, #a78bfa, #c4b5fd, #a78bfa);
                       -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                       background-clip: text">Orbit</span>
        </h1>

        <!-- Subtitle -->
        <p class="mt-3 px-4"
           style="font-size: 15px; color: #a8a29e; line-height: 1.65;
                  animation: orbit-fade-up 0.8s ease-out both; animation-delay: 0.4s; opacity: 0">
          Deine persönliche Kommandozentrale für den Arbeitsalltag — gebaut für Fokus, Struktur und Orientierung.
        </p>

        <!-- Feature chips -->
        <div class="flex flex-wrap justify-center gap-2.5 mt-5"
             style="animation: orbit-fade-up 0.8s ease-out both; animation-delay: 0.55s; opacity: 0">
          <div class="flex items-center gap-2 transition-all duration-150 cursor-default"
               style="border-radius: 100px; padding: 8px 14px;
                      background: rgba(28,25,23,0.7); backdrop-filter: blur(8px);
                      border: 1px solid #292524"
               onmouseenter="this.style.borderColor='#44403c';this.style.transform='translateY(-1px)'"
               onmouseleave="this.style.borderColor='#292524';this.style.transform='translateY(0)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
            <span style="font-size: 12.5px; font-weight: 500; color: #d6d3d1">Alles an einem Ort</span>
          </div>
          <div class="flex items-center gap-2 transition-all duration-150 cursor-default"
               style="border-radius: 100px; padding: 8px 14px;
                      background: rgba(28,25,23,0.7); backdrop-filter: blur(8px);
                      border: 1px solid #292524"
               onmouseenter="this.style.borderColor='#44403c';this.style.transform='translateY(-1px)'"
               onmouseleave="this.style.borderColor='#292524';this.style.transform='translateY(0)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style="font-size: 12.5px; font-weight: 500; color: #d6d3d1">Gebaut für Fokus</span>
          </div>
          <div class="flex items-center gap-2 transition-all duration-150 cursor-default"
               style="border-radius: 100px; padding: 8px 14px;
                      background: rgba(28,25,23,0.7); backdrop-filter: blur(8px);
                      border: 1px solid #292524"
               onmouseenter="this.style.borderColor='#44403c';this.style.transform='translateY(-1px)'"
               onmouseleave="this.style.borderColor='#292524';this.style.transform='translateY(0)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style="font-size: 12.5px; font-weight: 500; color: #d6d3d1">Deine Daten, lokal</span>
          </div>
        </div>

        <!-- CTA button -->
        <button (click)="configure.emit()"
                class="mt-7 transition-all duration-150 cursor-pointer"
                style="padding: 14px 36px; border-radius: 100px;
                       background: linear-gradient(135deg, #7c3aed, #6d28d9);
                       box-shadow: 0 6px 24px rgba(124,58,237,0.25);
                       font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 700; color: white;
                       border: none;
                       animation: orbit-fade-up 0.8s ease-out both; animation-delay: 0.7s; opacity: 0"
                onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 32px rgba(124,58,237,0.35)'"
                onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 6px 24px rgba(124,58,237,0.25)'">
          <span class="flex items-center gap-2">
            Einstellungen festlegen
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </span>
        </button>

        <!-- Hint -->
        <p class="mt-4"
           style="font-size: 12px; color: #44403c;
                  animation: orbit-fade-up 0.8s ease-out both; animation-delay: 0.85s; opacity: 0">
          Dauert nur wenige Minuten
        </p>
      </div>
    </div>
  `,
})
export class WelcomeScreenComponent {
  readonly configure = output<void>();
}
