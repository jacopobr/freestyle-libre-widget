// Variables used by Scriptable.
// These must be at the very top of the file. 

const LIBRE_LINK_UP_EMAIL = "your_libre_link_up_email"
const LIBRE_LINK_UP_PASSWORD = "your_libre_link_up_password"
const REGION = "your_region" // e.g. "us", "eu", "ap", "au", "ca", "de", "eu2", "fr", "jp", "la", "ae"
const CONNECTION_FIRST_NAME = "connection_first_name"
const CONNECTION_LAST_NAME = "connection_last_name"

// Constants. Do not edit.
const CLIENT_VERSION = "4.9.0";
const PRODUCT = "llu.android";
const REGIONAL_BASE_URLS = {
    ae: "https://api-ae.libreview.io/",
    ap: "https://api-ap.libreview.io/",
    au: "https://api-au.libreview.io/",
    ca: "https://api-ca.libreview.io/",
    de: "https://api-de.libreview.io/",
    eu: "https://api-eu.libreview.io/",
    eu2: "https://api-eu2.libreview.io/",
    fr: "https://api-fr.libreview.io/",
    jp: "https://api-jp.libreview.io/",
    la: "https://api-la.libreview.io/",
    us: "https://api-us.libreview.io/",
    default: "https://api.libreview.io/"
};
const LOGIN_PATH = "llu/auth/login"
const CONNECTION_PATH = "llu/connections"
const HEADERS = {
    "Product": PRODUCT,
    "Version": CLIENT_VERSION,
    "Content-Type": "application/json"
};
const TOKEN = "token";
const EXPIRATION_DATE = "expires";
const TREND_ARROW_SF_SYMBOLS = {
    1: "arrow.down",
    2: "arrow.down.right",
    3: "arrow.forward",
    4: "arrow.up.right",
    5: "arrow.up"
}
const GRADIENT_COLORS = {
    0: [new Color('#FF5722'), new Color('#F44336'), new Color('#D32F2F')],  // Red gradient with a smoother transition
    1: [new Color('#4caf50'), new Color('#66BB6A'), new Color('#388E3C')],    // Green gradient with added depth
    2: [new Color('#FFC107'), new Color('#FF9800'), new Color('#FFB400')],    // Yellow-orange gradient for more warmth
    3: [new Color('#FF5722'), new Color('#FF8A65'), new Color('#D32F2F')]     // Red gradient with a warmer transition
}
const UOM = {
    1: "mg/dL",
    2: "mmol/L"
}
const SENSOR_LIFESPAN_IN_DAYS = 14

/**
 * Login to LibreLinkUp client and save token in Keychain
 * @returns {void}
 */
async function login() {
    const loginUrl = `${REGIONAL_BASE_URLS.default}${LOGIN_PATH}`;
    const body = JSON.stringify({
        email: LIBRE_LINK_UP_EMAIL,
        password: LIBRE_LINK_UP_PASSWORD
    });

    try {
        var request = new Request(loginUrl);
        request.headers = HEADERS;
        request.body = body
        request.method = "POST";
        
        var response = await request.loadJSON();
        
        if (response && response.status === 0 && response.data && response.data.authTicket) {
            return cacheAuthToken(response.data.authTicket);
        } else {
            throw new Error('Login failed');
        }
    } catch (error) {
        console.error(`Login error: ${error}`);
        return null;
    }
}

/**
 * Get preferred connection details
 * @returns {object} connectionDetails
 */

async function getConnection() {
    const token = await getToken();
    const headersWithAuthorization = { ...HEADERS }; // Crea una copia di HEADERS
    headersWithAuthorization.Authorization = "Bearer " + token;

    const connectionsUrl = `${REGIONAL_BASE_URLS[REGION.toLowerCase()]}${CONNECTION_PATH}`;

    try {
        var request = new Request(connectionsUrl);
        request.headers = headersWithAuthorization;
        request.method = "GET";
        
        var response = await request.loadJSON();
        if (response && response.status === 0 && response.data) {
            return response.data.filter(connection => 
                connection.firstName.toLowerCase() === CONNECTION_FIRST_NAME.toLowerCase() && 
                connection.lastName.toLowerCase() === CONNECTION_LAST_NAME.toLowerCase()
              )[0];
        } else {
            throw new Error('Error getting connections');
        }
    } catch (error) {
        console.error(`Error getting connections: ${error}`);
        return null;
    }
}

/**
 * Save authorization token using Keychain
 * @param {object} authorizationResponse
 */
function cacheAuthToken(authorizationResponse) {
    Keychain.set(TOKEN, authorizationResponse.token);
    Keychain.set(EXPIRATION_DATE, authorizationResponse.expires.toString());
}

/**
 * Check if the token exists and it is not expired in Keychain
 * @returns {string} token
 */
async function getToken() {
    if (Keychain.contains(TOKEN) && Keychain.contains(EXPIRATION_DATE) ** !isTokenExpired(EXPIRATION_DATE)) {
        return Keychain.get(TOKEN);
    } else {
        await login();
        return getToken();
    }
}

/**
 * Check token is expired
 * @param {string} expirationDate
 * @return {boolean} validity
 */
function isTokenExpired(expirationDate) {
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime > Number(expirationDate);
}

/**
 * Calculate missing day from sensor expiration
 * @param {number} sensor 
 * @returns {number} diffInDays
 */
function getDaysDifference(sensorActivation) {
    const now = new Date();
    const timestampDate = new Date(sensorActivation * 1000);
    const diffMilliseconds = now - timestampDate;
    const diffDays = diffMilliseconds / (1000 * 60 * 60 * 24);
    return SENSOR_LIFESPAN_IN_DAYS - Math.floor(diffDays);
}


async function run() {
    const listWidget = new ListWidget();

    try {     
        const connection = await getConnection();
        const measurementColor = connection.glucoseMeasurement.MeasurementColor;
        const measurementValue = connection.glucoseMeasurement.Value;
        const measurementTrendArrow = connection.glucoseMeasurement.TrendArrow;
        const uom = connection.uom;
        const targetLow = connection.targetLow;
        const targetHigh = connection.targetHigh;
        const alarmLow = connection.patientDevice.l === true? connection.patientDevice.ll : "--";
        const alarmHigh = connection.patientDevice.h === true? connection.patientDevice.hl : "--";
        const updatedAt = new Date(connection.glucoseMeasurement.Timestamp).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
            });
        const sensorExpirationInDays = getDaysDifference(connection.sensor.a);

        if (config.runsInAccessoryWidget) {
            // GLUCOSE MEASUREMENT ROW
            const glucoseRow = listWidget.addStack();
            glucoseRow.layoutHorizontally()
            const glucoseMeasurementValue = glucoseRow.addText(measurementValue.toString());
            glucoseMeasurementValue.textColor = Color.white();
            glucoseMeasurementValue.font = Font.heavySystemFont(24);

            let glucoseColumn = glucoseRow.addStack()
            glucoseColumn.layoutVertically()
            glucoseColumn.centerAlignContent()
            glucoseColumn.addSpacer(10)

            const arrowSymbol = SFSymbol.named(TREND_ARROW_SF_SYMBOLS[measurementTrendArrow]);
            arrowSymbol.applyHeavyWeight();
            const arrowImage = glucoseColumn.addImage(arrowSymbol.image);
            arrowImage.tintColor = Color.white();
            arrowImage.imageSize = new Size(15, 15);

        } else if (config.runsInWidget || config.runsInApp) {
            // BACKGROUND CONFIG
            const gradient = new LinearGradient();
            gradient.colors = GRADIENT_COLORS[measurementColor];
            gradient.locations = [0.0, 1];
            listWidget.backgroundGradient = gradient;
            
            // UPDATED AT ROW
            const updatedAtRow = listWidget.addStack();
            updatedAtRow.layoutHorizontally();
            updatedAtRow.topAlignContent();
            
            const updatedAtRowText = updatedAtRow.addText(`Updated at: ${updatedAt}`)
            updatedAtRowText.textColor = Color.white();
            updatedAtRowText.font = Font.regularSystemFont(11);
            listWidget.addSpacer(10);
            
            // GLUCOSE MEASUREMENT ROW
            const glucoseRow = listWidget.addStack();
            glucoseRow.layoutHorizontally()
            const glucoseMeasurementValue = glucoseRow.addText(measurementValue.toString());
            glucoseMeasurementValue.textColor = Color.white();
            glucoseMeasurementValue.font = Font.heavySystemFont(42);
            glucoseRow.addSpacer(10)

            let glucoseColumn = glucoseRow.addStack()
            glucoseColumn.layoutVertically()
            glucoseColumn.centerAlignContent()
            glucoseColumn.addSpacer(10)

            const arrowSymbol = SFSymbol.named(TREND_ARROW_SF_SYMBOLS[measurementTrendArrow]);
            arrowSymbol.applyHeavyWeight();
            const arrowImage = glucoseColumn.addImage(arrowSymbol.image);
            arrowImage.tintColor = Color.white();
            arrowImage.imageSize = new Size(20, 20);

            const unitOfMeasure = glucoseColumn.addText(UOM[uom])
            unitOfMeasure.textColor = Color.white();
            unitOfMeasure.font = Font.regularSystemFont(11)
            listWidget.addSpacer(2);

            // TARGET INTERVAL ROW
            const targetRow = listWidget.addStack();
            targetRow.centerAlignContent();
            const targetRowText = targetRow.addText(`Target: ${targetLow} - ${targetHigh}`);
            targetRowText.textColor = Color.white();
            targetRowText.font = Font.regularSystemFont(12)
            listWidget.addSpacer(2);

            // ALARM RULES ROW
            const alarmRow = listWidget.addStack();
            const alarmRowText = alarmRow.addText(`Alarms: ${alarmLow} - ${alarmHigh}`);
            alarmRowText.textColor = Color.white();
            alarmRowText.font = Font.regularSystemFont(12)
            listWidget.addSpacer(2);
            
            //SENSOR EOL
            const sensorEolRow = listWidget.addStack();
            const sensorEolText = sensorEolRow.addText(`Sensor: ${sensorExpirationInDays} days left`)
            sensorEolText.textColor = Color.white();
            sensorEolText.font = Font.regularSystemFont(12)
            listWidget.presentSmall();
        }  

    } catch(error) {
        console.log(`Could not render widget: ${error}`);
    }

    Script.setWidget(listWidget);
    Script.complete();
}

await run();