import "./Footer.css";

export default function Footer({ role = "patient", onNavigate }) {
  const isProvider = role === "provider";

  const platformLinks = isProvider
    ? ["Provider Dashboard", "Schedule", "Patient Records", "Messages"]
    : [
        "Patient Dashboard",
        "Appointments",
        "My Care Team",
        "Records",
        "Messages",
      ];

  const supportLinks = [
    "Help Center",
    "Contact Us",
    "Privacy Policy",
    "Terms of Service",
  ];

  const handleFooterLink = (label) => {
    if (label === "Provider Dashboard") onNavigate?.("dashboard");
    else if (label === "Schedule") onNavigate?.("schedule");
    else if (label === "Patient Records") onNavigate?.("patient-records");
    else if (label === "Patient Dashboard") onNavigate?.("dashboard");
    else if (label === "Appointments") onNavigate?.("appointments");
    else if (label === "My Care Team") onNavigate?.("care-team");
    else if (label === "Records") onNavigate?.("records");
    else if (label === "Messages") onNavigate?.("messages");
    else window.alert(`${label} page coming soon.`);
  };

  return (
    <>
      <footer className='dash-footer'>
        <div className='dash-footer-left'>
          <span className='dash-logo'>
            <u>HealthNest</u>
          </span>

          <p className='dash-footer-tag'>
            Coordinated care across clinics,
            <br />
            built for patients and providers.
          </p>
        </div>

        <div className='dash-footer-links'>
          <div>
            <p className='dash-footer-heading'>PLATFORM</p>

            {platformLinks.map((link) => (
              <button
                key={link}
                type='button'
                className='dash-footer-link'
                onClick={() => handleFooterLink(link)}>
                {link}
              </button>
            ))}
          </div>

          <div>
            <p className='dash-footer-heading'>SUPPORT</p>

            {supportLinks.map((link) => (
              <button
                key={link}
                type='button'
                className='dash-footer-link'
                onClick={() => handleFooterLink(link)}>
                {link}
              </button>
            ))}
          </div>
        </div>
      </footer>

      <div className='dash-copyright'>
        © 2026 HealthNest Technologies, Inc. All rights reserved.
      </div>
    </>
  );
}
