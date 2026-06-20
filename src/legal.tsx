export function ImpressumPage() {
  return (
    <main className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans p-4 md:p-8">
      <article className="max-w-3xl mx-auto bg-white p-8 rounded-[32px] border border-black/5 prose prose-sm">
        <h1>Impressum</h1>

        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          KnZ Sports Media<br />
          Knud Zabrocki<br />
          Paul-Schallück-Straße 19<br />
          50939 Köln<br />
          Deutschland
        </p>

        <h2>Kontakt</h2>
        <p>
          Telefon: 0221 42300019<br />
          E-Mail: info@knud-zabrocki.de
        </p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          Knud Zabrocki<br />
          Paul-Schallück-Straße 19<br />
          50939 Köln<br />
          Deutschland
        </p>

        <h2>Haftung für Inhalte</h2>
        <p>
          Die Inhalte dieser Anwendung wurden mit größter Sorgfalt erstellt.
          Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann
          jedoch keine Gewähr übernommen werden.
        </p>

        <h2>Haftung für Links</h2>
        <p>
          Diese Anwendung kann Links zu externen Webseiten Dritter enthalten,
          auf deren Inhalte kein Einfluss besteht. Für die Inhalte der
          verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
          verantwortlich.
        </p>

        <h2>Urheberrecht</h2>
        <p>
          Die durch den Betreiber dieser Anwendung erstellten Inhalte und Werke
          unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und Verwertung außerhalb der Grenzen des
          Urheberrechts bedürfen der vorherigen schriftlichen Zustimmung.
        </p>

        <h2>Hinweis zur Anwendung</h2>
        <p>
          Der VBL Match Report Automator ist ein technisches Hilfsmittel zur
          strukturierten Erstellung, Prüfung und Verwaltung von Volleyball-
          Spielberichten. Einzelheiten zur Verarbeitung personenbezogener Daten
          finden sich in der separaten Datenschutzerklärung.
        </p>

        <p>
          <a href="/">Zurück zur Anwendung</a>
        </p>
      </article>
    </main>
  );
}

export function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans p-4 md:p-8">
      <article className="max-w-3xl mx-auto bg-white p-8 rounded-[32px] border border-black/5 prose prose-sm">
        <h1>Datenschutzerklärung</h1>

        <h2>1. Datenschutz auf einen Blick</h2>
        <p>
          Diese Datenschutzerklärung informiert darüber, welche
          personenbezogenen Daten bei der Nutzung des VBL Match Report
          Automators verarbeitet werden.
        </p>

        <h2>2. Verantwortliche Stelle</h2>
        <p>
          KnZ Sports Media<br />
          Knud Zabrocki<br />
          Paul-Schallück-Straße 19<br />
          50939 Köln<br />
          Deutschland
        </p>
        <p>
          Telefon: 0221 42300019<br />
          E-Mail: info@knud-zabrocki.de
        </p>

        <h2>3. Hosting über Vercel</h2>
        <p>
          Diese Anwendung wird extern gehostet bei Vercel Inc., 340 S Lemon Ave
          #4133, Walnut, CA 91789, USA. Beim Aufruf der Anwendung können
          technische Zugriffsdaten verarbeitet werden, insbesondere IP-Adresse,
          Zeitpunkt des Zugriffs, Browser- und Geräteinformationen sowie
          Serverlogs.
        </p>

        <h2>4. Hinweise zur Auftragsverarbeitung bei Vercel</h2>
        <p>
          Diese Anwendung wird derzeit im Free-/Hobby-Tarif von Vercel
          bereitgestellt. Vercel stellt rechtliche Informationen zur
          Datenverarbeitung sowie ein Data Processing Addendum bereit:
          https://vercel.com/legal/dpa.
        </p>
        <p>
          Nach den Angaben von Vercel gilt das Data Processing Addendum für
          Kunden auf Enterprise- und Pro-Plänen. Da diese Anwendung derzeit im
          Free-/Hobby-Tarif betrieben wird, wird an dieser Stelle nicht
          behauptet, dass ein gesonderter Auftragsverarbeitungsvertrag mit
          Vercel abgeschlossen wurde.
        </p>

        <h2>5. Firebase Authentication</h2>
        <p>
          Diese Anwendung nutzt Firebase Authentication zur Anmeldung
          berechtigter Nutzer, insbesondere für den Admin-Modus. Dabei können
          insbesondere Name, E-Mail-Adresse, Profilbild, Nutzer-ID und
          Authentifizierungs-Token verarbeitet werden.
        </p>

        <h2>6. Firebase Firestore</h2>
        <p>
          Diese Anwendung nutzt Firebase Firestore zur Speicherung und Verwaltung
          geprüfter Matchdaten und Spielberichte.
        </p>

        <h2>7. Google Gemini API / KI-Verarbeitung</h2>
        <p>
          Diese Anwendung nutzt serverseitig die Google Gemini API zur
          KI-gestützten Extraktion und Strukturierung von Matchdaten. Die Gemini
          API wird nicht direkt aus dem Browser aufgerufen. Der Gemini API Key
          wird nicht im Browser ausgeliefert.
        </p>

        <h2>8. Serverseitiger Abruf von VBL-Matchseiten</h2>
        <p>
          Sobald eine Match-ID bekannt ist, ruft die Anwendung serverseitig die
          zugehörige öffentlich verfügbare Matchdetailseite der Volleyball
          Bundesliga ab. Der Abruf dient der strukturierten Extraktion von
          öffentlich verfügbaren Matchdaten.
        </p>

        <h2>9. Cookies und vergleichbare Technologien</h2>
        <p>
          Für den Betrieb der Anwendung können technisch erforderliche Speicher-
          oder Authentifizierungsmechanismen eingesetzt werden, insbesondere im
          Zusammenhang mit dem Login und der Sitzungsverwaltung. Nicht technisch
          erforderliche Cookies, Tracking-Technologien oder vergleichbare
          Verfahren werden nur eingesetzt, wenn hierfür eine Rechtsgrundlage
          besteht und, soweit erforderlich, eine Einwilligung eingeholt wurde.
        </p>

        <h2>10. Vercel Web Analytics</h2>
        <p>
          Vercel Web Analytics ist derzeit nicht zwingend für den Betrieb der
          Anwendung erforderlich. Sofern Vercel Web Analytics künftig aktiviert
          wird, wird diese Datenschutzerklärung entsprechend ergänzt.
        </p>

        <h2>11. Ihre Rechte</h2>
        <p>
          Sie haben im Rahmen der gesetzlichen Bestimmungen insbesondere Rechte
          auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit, Widerspruch sowie Beschwerde bei einer
          Datenschutzaufsichtsbehörde.
        </p>

        <p>Stand: Juni 2026</p>

        <p>
          <a href="/">Zurück zur Anwendung</a>
        </p>
      </article>
    </main>
  );
}