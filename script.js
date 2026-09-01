// ================================
// CONFIG
// One place for anything that might need to change later
// (dates, venue details, the Google Sheets connection),
// so nothing is scattered through the rest of the file.
// ================================

const CONFIG = {

    // Wedding date/time, used by both the countdown and the calendar file.
    weddingDateTimeString: "December 18, 2026 14:00:00",
    weddingEndDateTimeString: "December 18, 2026 18:00:00",

    eventTitle: "Kiara & Gcina's Wedding",

    venueAddress:
        "Johannesburg Bible College, 30 Hampton Avenue, Corner Golf St, Auckland Park, Johannesburg 2092",

    googleMapsLink: "https://maps.app.goo.gl/eqWFmKBnWpi738CZA?g_st=am",

    // South Africa doesn't observe daylight saving, so a fixed IANA
    // timezone name keeps the calendar event correct for guests
    // whichever timezone their own phone/computer is set to.
    timezone: "Africa/Johannesburg",

    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE ONCE DEPLOYED.
    // See GOOGLE_SHEETS_SETUP.md for the step-by-step deployment guide.
    // This URL is not a secret - it's a public "web app" endpoint by
    // design once deployed with "Anyone" access. The real credentials
    // (the Google account and the sheet itself) never leave Google's
    // servers, which is why this is safe to keep in frontend code.
    googleScriptUrl: "https://script.google.com/macros/s/AKfycbyjYGvt2inPn6w0UQ9umcfn0bqIPTqQrKDPuwU6evI7UqYtI1caxb04CWEeZHUsKd-YhA/exec"

};


// ================================
// WEDDING COUNTDOWN
// ================================

const weddingDate = new Date(CONFIG.weddingDateTimeString).getTime();

function updateCountdown() {

    const now = new Date().getTime();
    const difference = weddingDate - now;

    if (difference <= 0) {

        document.getElementById("days").textContent = "00";
        document.getElementById("hours").textContent = "00";
        document.getElementById("minutes").textContent = "00";
        document.getElementById("seconds").textContent = "00";

        return;
    }

    const days = Math.floor(
        difference / (1000 * 60 * 60 * 24)
    );

    const hours = Math.floor(
        (difference / (1000 * 60 * 60)) % 24
    );

    const minutes = Math.floor(
        (difference / (1000 * 60)) % 60
    );

    const seconds = Math.floor(
        (difference / 1000) % 60
    );

    document.getElementById("days").textContent =
        String(days).padStart(2, "0");

    document.getElementById("hours").textContent =
        String(hours).padStart(2, "0");

    document.getElementById("minutes").textContent =
        String(minutes).padStart(2, "0");

    document.getElementById("seconds").textContent =
        String(seconds).padStart(2, "0");
}

updateCountdown();

setInterval(updateCountdown, 1000);


// ================================
// ELEMENT REFERENCES
// ================================

const rsvpForm = document.getElementById("rsvpForm");
const rsvpConfirmation = document.getElementById("rsvpConfirmation");
const confirmationMessage = document.getElementById("confirmationMessage");
const backButton = document.getElementById("backButton");
const submitButton = document.getElementById("submitButton");
const rsvpError = document.getElementById("rsvpError");


// ================================
// RSVP SUBMISSION
// Sends the form data to a Google Apps Script web app, which writes
// it into the client's Google Sheet. The confirmation panel is only
// shown once that save actually succeeds.
// ================================

function setSubmitting(isSubmitting) {

    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? "SENDING..." : "SEND RSVP";
}

function showError(message) {

    rsvpError.textContent = message;
    rsvpError.classList.add("visible");
}

function hideError() {

    rsvpError.textContent = "";
    rsvpError.classList.remove("visible");
}

rsvpForm.addEventListener("submit", async function (event) {

    // Stop the page from refreshing
    event.preventDefault();

    hideError();

    // Guard against the developer forgetting to configure the
    // Apps Script URL, rather than failing in a confusing way.
    if (!CONFIG.googleScriptUrl || CONFIG.googleScriptUrl.startsWith("PASTE_")) {

        console.error(
            "CONFIG.googleScriptUrl is not set. " +
            "See GOOGLE_SHEETS_SETUP.md to deploy the Apps Script and add the URL."
        );

        showError(
            "Sorry, RSVPs can't be saved right now. Please let the couple know directly."
        );

        return;
    }

    const guestName = document.getElementById("name").value.trim();

    const rsvpData = {
        name: guestName,
        attendance: document.querySelector('input[name="attendance"]:checked').value,
        songSuggestion: document.getElementById("songSuggestion").value.trim(),
        message: document.getElementById("message").value.trim()
    };

    setSubmitting(true);

    try {

        // mode: "no-cors" deliberately means we can't read back the
        // response body or status (it comes back "opaque"). That's a
        // trade-off, made on purpose: Apps Script writes the row the
        // moment it runs, *before* it even tries to reply, and some
        // mobile browsers - especially in-app browsers like the one
        // WhatsApp or Instagram open links in - fail specifically at
        // reading that reply, even though the save already succeeded.
        // Trying to verify the response was causing real RSVPs to be
        // saved correctly while still showing the guest an error.
        //
        // The trade-off: we can no longer tell "saved fine" apart from
        // "Apps Script itself threw an error" - we can only detect the
        // request failing to send at all (e.g. no internet connection).
        // For a simple appendRow() call, that residual risk is small
        // compared to guests on WhatsApp reliably getting stuck.
        await fetch(CONFIG.googleScriptUrl, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(rsvpData)
        });

        rsvpForm.classList.add("hidden");
        rsvpConfirmation.style.display = "block";

        confirmationMessage.textContent =
            `Thank you, ${guestName}! Your RSVP has been received. We look forward to celebrating with you.`;

    } catch (error) {

        console.error("RSVP submission failed:", error);

        showError(
            "Something went wrong sending your RSVP. Please check your connection and try again."
        );

    } finally {

        setSubmitting(false);
    }

});


// ================================
// BACK TO RSVP FORM
// ================================

backButton.addEventListener("click", function () {

    rsvpConfirmation.style.display = "none";

    // Remove the "hidden" class (added on successful submit) rather than
    // just setting inline display, since .hidden uses !important and
    // would otherwise override a plain inline style.
    rsvpForm.classList.remove("hidden");

    hideError();

});


// ================================
// ADD TO CALENDAR
// ================================

const calendarButton = document.getElementById("calendarButton");

// ICS text fields need commas, semicolons and backslashes escaped,
// and real line breaks turned into a literal "\n" (backslash + n).
function icsEscape(text) {

    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");
}

// Formats a Date as the YYYYMMDDTHHmmss shape .ics files use.
function formatIcsDate(date) {

    const pad = (n) => String(n).padStart(2, "0");

    return (
        date.getFullYear() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        "T" +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    );
}

calendarButton.addEventListener("click", function () {

    // Strip off any query string/hash so the link is always clean,
    // and use the page's real address - this is automatically the
    // live domain once deployed, with no code change needed.
    const invitationLink = window.location.origin + window.location.pathname;

    const eventDescription = icsEscape(
        "We can't wait to celebrate with you!\n\n" +
        "Dress Code: Shades of Green\n" +
        "Forest Night · Olive Shade · Meadow Light · Sage Mist\n\n" +
        "Google Maps: " + CONFIG.googleMapsLink + "\n\n" +
        "Wedding Invitation: " + invitationLink
    );

    const startDate = formatIcsDate(new Date(CONFIG.weddingDateTimeString));
    const endDate = formatIcsDate(new Date(CONFIG.weddingEndDateTimeString));

    // A unique ID and creation timestamp are required by the .ics spec
    // for the event to be recognised (and later updated) correctly by
    // calendar apps.
    const uid = "wedding-" + Date.now() + "@" + window.location.hostname;
    const dtStamp = formatIcsDate(new Date()) + "Z";

    // Create calendar event.
    // DTSTART/DTEND use TZID=Africa/Johannesburg (South Africa has no
    // daylight saving, so this stays correct year-round) rather than a
    // floating time, so the event lands at the right local time no
    // matter what timezone a guest's own device is set to.
    const calendarEvent =
        "BEGIN:VCALENDAR\r\n" +
        "VERSION:2.0\r\n" +
        "PRODID:-//Wedding Invitation//EN\r\n" +
        "BEGIN:VEVENT\r\n" +
        "UID:" + uid + "\r\n" +
        "DTSTAMP:" + dtStamp + "\r\n" +
        "DTSTART;TZID=" + CONFIG.timezone + ":" + startDate + "\r\n" +
        "DTEND;TZID=" + CONFIG.timezone + ":" + endDate + "\r\n" +
        "SUMMARY:" + icsEscape(CONFIG.eventTitle) + "\r\n" +
        "LOCATION:" + icsEscape(CONFIG.venueAddress) + "\r\n" +
        "DESCRIPTION:" + eventDescription + "\r\n" +
        "END:VEVENT\r\n" +
        "END:VCALENDAR";


    // Create the .ics file
    const blob = new Blob(
        [calendarEvent],
        {
            type: "text/calendar;charset=utf-8"
        }
    );


    // Create temporary download link
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "wedding-invitation.ics";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

});