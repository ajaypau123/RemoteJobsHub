"""Directory of curated tech companies with official public ATS endpoints.

Each company is verified to provide an unauthenticated, public REST API
via Greenhouse, Lever, Ashby, SmartRecruiters, or Workday.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ATSCompany:
    name: str                                # Display company name (e.g. "Meesho")
    ats_type: str                            # "greenhouse" | "lever" | "ashby" | "smartrecruiters"
    slug: str                                # Board token / subdomain slug
    extra_params: dict | None = None         # Optional query parameters (e.g. {"country": "in"})


# Curated list of top-tier companies actively hiring in India and/or Worldwide Remote
DEFAULT_ATS_COMPANIES: list[ATSCompany] = [
    # ── Greenhouse ─────────────────────────────────────────────────────────────
    ATSCompany(name="InMobi", ats_type="greenhouse", slug="inmobi"),
    ATSCompany(name="Groww", ats_type="greenhouse", slug="groww"),
    ATSCompany(name="Slice", ats_type="greenhouse", slug="slice"),
    ATSCompany(name="Deliveroo", ats_type="greenhouse", slug="deliveroo"),
    ATSCompany(name="Zscaler", ats_type="greenhouse", slug="zscaler"),
    ATSCompany(name="Samsara", ats_type="greenhouse", slug="samsara"),
    ATSCompany(name="Toast", ats_type="greenhouse", slug="toast"),
    ATSCompany(name="Instawork", ats_type="greenhouse", slug="instawork"),
    ATSCompany(name="CommerceIQ", ats_type="greenhouse", slug="commerceiq"),
    ATSCompany(name="Smartsheet", ats_type="greenhouse", slug="smartsheet"),
    ATSCompany(name="Databricks", ats_type="greenhouse", slug="databricks"),
    ATSCompany(name="Grafana Labs", ats_type="greenhouse", slug="grafanalabs"),
    ATSCompany(name="GitLab", ats_type="greenhouse", slug="gitlab"),
    ATSCompany(name="Canonical", ats_type="greenhouse", slug="canonical"),
    ATSCompany(name="Elastic", ats_type="greenhouse", slug="elastic"),
    ATSCompany(name="Stripe", ats_type="greenhouse", slug="stripe"),
    ATSCompany(name="Figma", ats_type="greenhouse", slug="figma"),
    ATSCompany(name="Cloudflare", ats_type="greenhouse", slug="cloudflare"),
    ATSCompany(name="Thoughtworks", ats_type="greenhouse", slug="thoughtworks"),
    ATSCompany(name="Karat", ats_type="greenhouse", slug="karat"),
    ATSCompany(name="MongoDB", ats_type="greenhouse", slug="mongodb"),
    ATSCompany(name="Twilio", ats_type="greenhouse", slug="twilio"),
    ATSCompany(name="Pinterest", ats_type="greenhouse", slug="pinterest"),
    ATSCompany(name="Airbnb", ats_type="greenhouse", slug="airbnb"),
    ATSCompany(name="Robinhood", ats_type="greenhouse", slug="robinhood"),
    ATSCompany(name="Instacart", ats_type="greenhouse", slug="instacart"),
    ATSCompany(name="HackerRank", ats_type="greenhouse", slug="hackerrank"),
    ATSCompany(name="Okta", ats_type="greenhouse", slug="okta"),
    ATSCompany(name="Coinbase", ats_type="greenhouse", slug="coinbase"),
    ATSCompany(name="Scale AI", ats_type="greenhouse", slug="scaleai"),
    ATSCompany(name="Lyft", ats_type="greenhouse", slug="lyft"),
    ATSCompany(name="Reddit", ats_type="greenhouse", slug="reddit"),
    ATSCompany(name="Gusto", ats_type="greenhouse", slug="gusto"),
    ATSCompany(name="Discord", ats_type="greenhouse", slug="discord"),
    ATSCompany(name="Checkr", ats_type="greenhouse", slug="checkr"),
    ATSCompany(name="Datadog", ats_type="greenhouse", slug="datadog"),
    ATSCompany(name="Rubrik", ats_type="greenhouse", slug="rubrik"),
    ATSCompany(name="Mozilla", ats_type="greenhouse", slug="mozilla"),
    ATSCompany(name="Affirm", ats_type="greenhouse", slug="affirm"),
    ATSCompany(name="Brex", ats_type="greenhouse", slug="brex"),
    ATSCompany(name="Carta", ats_type="greenhouse", slug="carta"),
    ATSCompany(name="Chime", ats_type="greenhouse", slug="chime"),
    ATSCompany(name="SoFi", ats_type="greenhouse", slug="sofi"),
    ATSCompany(name="Monzo", ats_type="greenhouse", slug="monzo"),
    ATSCompany(name="N26", ats_type="greenhouse", slug="n26"),
    ATSCompany(name="Wise", ats_type="greenhouse", slug="wise"),
    ATSCompany(name="Adyen", ats_type="greenhouse", slug="adyen"),
    ATSCompany(name="Duolingo", ats_type="greenhouse", slug="duolingo"),
    ATSCompany(name="Gemini", ats_type="greenhouse", slug="gemini"),
    ATSCompany(name="Razorpay", ats_type="greenhouse", slug="razorpaysoftwareprivatelimited"),
    ATSCompany(name="Quince", ats_type="greenhouse", slug="quince"),
    ATSCompany(name="Tenstorrent", ats_type="greenhouse", slug="tenstorrent"),
    ATSCompany(name="Glance", ats_type="greenhouse", slug="glance"),
    ATSCompany(name="Motive", ats_type="greenhouse", slug="motive"),
    ATSCompany(name="Ethos Life", ats_type="greenhouse", slug="ethos"),
    ATSCompany(name="Druva", ats_type="greenhouse", slug="druva"),

    # ── Lever ──────────────────────────────────────────────────────────────────
    ATSCompany(name="Paytm", ats_type="lever", slug="paytm"),
    ATSCompany(name="Meesho", ats_type="lever", slug="meesho"),
    ATSCompany(name="CRED", ats_type="lever", slug="cred"),
    ATSCompany(name="Porter", ats_type="lever", slug="porter"),
    ATSCompany(name="Pocket FM", ats_type="lever", slug="pocketfm"),
    ATSCompany(name="Zeta", ats_type="lever", slug="zeta"),
    ATSCompany(name="Fi Money", ats_type="lever", slug="fi"),
    ATSCompany(name="Acceldata", ats_type="lever", slug="acceldata"),
    ATSCompany(name="JumpCloud", ats_type="lever", slug="jumpcloud"),
    ATSCompany(name="Hevo Data", ats_type="lever", slug="hevodata"),
    ATSCompany(name="Everbridge", ats_type="lever", slug="everbridge"),
    ATSCompany(name="Endpoint Clinical", ats_type="lever", slug="endpointclinical"),
    ATSCompany(name="Spotify", ats_type="lever", slug="spotify"),
    ATSCompany(name="Saviynt", ats_type="lever", slug="saviynt"),
    ATSCompany(name="Gushwork", ats_type="lever", slug="gushwork"),
    ATSCompany(name="Neuron7", ats_type="lever", slug="neuron7"),
    ATSCompany(name="Zimperium", ats_type="lever", slug="zimperium"),
    ATSCompany(name="Alif Semiconductor", ats_type="lever", slug="alifsemi"),
    ATSCompany(name="Kobie Marketing", ats_type="lever", slug="kobie"),

    # ── Ashby ──────────────────────────────────────────────────────────────────
    ATSCompany(name="Sarvam AI", ats_type="ashby", slug="sarvam"),
    ATSCompany(name="SpotDraft", ats_type="ashby", slug="spotdraft"),
    ATSCompany(name="Ema", ats_type="ashby", slug="ema"),
    ATSCompany(name="AiPrise", ats_type="ashby", slug="aiprise"),
    ATSCompany(name="Avoca", ats_type="ashby", slug="avoca"),
    ATSCompany(name="Bolna AI", ats_type="ashby", slug="bolna"),
    ATSCompany(name="Atlan", ats_type="ashby", slug="atlan"),
    ATSCompany(name="Navi", ats_type="ashby", slug="navi"),
    ATSCompany(name="Supabase", ats_type="ashby", slug="supabase"),
    ATSCompany(name="Synthesia", ats_type="ashby", slug="synthesia"),
    ATSCompany(name="ElevenLabs", ats_type="ashby", slug="elevenlabs"),
    ATSCompany(name="Modal", ats_type="ashby", slug="modal"),
    ATSCompany(name="Zapier", ats_type="ashby", slug="zapier"),
    ATSCompany(name="Replit", ats_type="ashby", slug="replit"),
    ATSCompany(name="OpenAI", ats_type="ashby", slug="openai"),
    ATSCompany(name="Cohere", ats_type="ashby", slug="cohere"),
    ATSCompany(name="LangChain", ats_type="ashby", slug="langchain"),
    ATSCompany(name="PostHog", ats_type="ashby", slug="posthog"),
    ATSCompany(name="Airbyte", ats_type="ashby", slug="airbyte"),
    ATSCompany(name="Resend", ats_type="ashby", slug="resend"),
    ATSCompany(name="Oyster", ats_type="ashby", slug="oyster"),
    ATSCompany(name="Linear", ats_type="ashby", slug="linear"),
    ATSCompany(name="Notion", ats_type="ashby", slug="notion"),
    ATSCompany(name="Cursor", ats_type="ashby", slug="cursor"),
    ATSCompany(name="Ramp", ats_type="ashby", slug="ramp"),
    ATSCompany(name="Perplexity", ats_type="ashby", slug="perplexity"),
    ATSCompany(name="CertifyOS", ats_type="ashby", slug="certifyos"),
    ATSCompany(name="Smallest AI", ats_type="ashby", slug="smallest"),
    ATSCompany(name="Genera", ats_type="ashby", slug="genera"),
    ATSCompany(name="SigNoz", ats_type="ashby", slug="signoz"),
    ATSCompany(name="Baseten", ats_type="ashby", slug="baseten"),
    ATSCompany(name="Deepgram", ats_type="ashby", slug="deepgram"),

    # ── SmartRecruiters ────────────────────────────────────────────────────────
    ATSCompany(name="Bosch Group", ats_type="smartrecruiters", slug="BoschGroup", extra_params={"country": "in"}),
    ATSCompany(name="Ubisoft", ats_type="smartrecruiters", slug="Ubisoft2", extra_params={"country": "in"}),
    ATSCompany(name="Avery Dennison", ats_type="smartrecruiters", slug="AveryDennison", extra_params={"country": "in"}),
    ATSCompany(name="SGS", ats_type="smartrecruiters", slug="SGS", extra_params={"country": "in"}),
    ATSCompany(name="Freshworks", ats_type="smartrecruiters", slug="freshworks", extra_params={"country": "in"}),
]


@dataclass(frozen=True)
class WorkdayCompany:
    """Configuration for an enterprise company using Workday's public CXS API."""
    name: str                                # Display company name (e.g. "PwC", "Nvidia")
    subdomain: str                           # Subdomain prefix (e.g. "pwc.wd3", "nvidia.wd5")
    tenant: str                              # Workday tenant ID (e.g. "pwc", "nvidia")
    site: str                                # Career site slug (e.g. "Global_Experienced_Careers")
    country_filter: str = "India"            # Search keyword or country filter


# Curated Big 4 & Global Tech MNCs using Workday with verified public endpoints
DEFAULT_WORKDAY_COMPANIES: list[WorkdayCompany] = [
    WorkdayCompany(name="PwC", subdomain="pwc.wd3", tenant="pwc", site="Global_Experienced_Careers"),
    WorkdayCompany(name="Target", subdomain="target.wd5", tenant="target", site="targetcareers", country_filter="India"),
    WorkdayCompany(name="Nvidia", subdomain="nvidia.wd5", tenant="nvidia", site="NVIDIAExternalCareerSite"),
    WorkdayCompany(name="Mastercard", subdomain="mastercard.wd1", tenant="mastercard", site="CorporateCareers"),
    WorkdayCompany(name="Adobe", subdomain="adobe.wd5", tenant="adobe", site="external_experienced"),
    WorkdayCompany(name="HP", subdomain="hp.wd5", tenant="hp", site="ExternalCareerSite"),
    WorkdayCompany(name="Autodesk", subdomain="autodesk.wd1", tenant="autodesk", site="Ext"),
    WorkdayCompany(name="Walmart Global Tech", subdomain="walmart.wd504", tenant="walmart", site="WalmartExternal", country_filter="Bangalore"),
    WorkdayCompany(name="Cisco", subdomain="cisco.wd5", tenant="cisco", site="Cisco_Careers", country_filter="India"),
    WorkdayCompany(name="Salesforce", subdomain="salesforce.wd12", tenant="salesforce", site="External_Career_Site", country_filter="India"),
    WorkdayCompany(name="Postman", subdomain="postman.wd108", tenant="postman", site="careers", country_filter="India"),
    WorkdayCompany(name="BrowserStack", subdomain="browserstack.wd3", tenant="browserstack", site="External", country_filter="India"),
    WorkdayCompany(name="Broadcom", subdomain="broadcom.wd1", tenant="broadcom", site="External_Career", country_filter="India"),
    WorkdayCompany(name="Micron Technology", subdomain="micron.wd1", tenant="micron", site="External", country_filter="India"),
    WorkdayCompany(name="Cadence Design", subdomain="cadence.wd1", tenant="cadence", site="External_Careers", country_filter="India"),
    WorkdayCompany(name="Analog Devices", subdomain="analogdevices.wd1", tenant="analogdevices", site="External", country_filter="India"),
    WorkdayCompany(name="Intel", subdomain="intel.wd1", tenant="intel", site="External", country_filter="India"),
    WorkdayCompany(name="Applied Materials", subdomain="amat.wd1", tenant="amat", site="External", country_filter="India"),
    WorkdayCompany(name="PayPal", subdomain="paypal.wd1", tenant="paypal", site="jobs", country_filter="India"),
    WorkdayCompany(name="Motorola Solutions", subdomain="motorolasolutions.wd5", tenant="motorolasolutions", site="Careers", country_filter="India"),
    WorkdayCompany(name="NXP Semiconductors", subdomain="nxp.wd3", tenant="nxp", site="careers", country_filter="India"),
]
