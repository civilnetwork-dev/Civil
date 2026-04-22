from flask import Flask, request, jsonify
from adblock import FilterSet, Engine
import httpcore
import time
import base64

app = Flask(__name__)

engine = None
last_update = 0
UPDATE_INTERVAL = 3600


def fetch_easylist():
    """Fetch EasyList from easylist.to"""
    url = "https://easylist.to/easylist/easylist.txt"

    with httpcore.ConnectionPool() as pool:
        response = pool.request("GET", url)
        if response.status == 200:
            return response.content.decode("utf-8")
        else:
            raise Exception(f"Failed to fetch EasyList: {response.status}")


def load_filters():
    """Load or reload filter rules"""
    global engine, last_update

    print("Fetching EasyList...")
    filter_text = fetch_easylist()

    filter_set = FilterSet()
    filter_set.add_filter_list(filter_text)

    engine = Engine(filter_set)
    last_update = time.time()
    print("Filters loaded successfully")


def ensure_filters_loaded():
    """Ensure filters are loaded and up to date"""
    global engine, last_update

    if engine is None or (time.time() - last_update) > UPDATE_INTERVAL:
        load_filters()


def is_base64(s):
    """Check if string is valid base64"""
    try:
        if "-" in s or "_" in s:
            decoded = base64.urlsafe_b64decode(s + "=" * (4 - len(s) % 4))
        else:
            decoded = base64.b64decode(s + "=" * (4 - len(s) % 4))

        decoded_str = decoded.decode("utf-8")
        return decoded_str.startswith(("http://", "https://", "www.", "//", "ftp://"))
    except Exception:
        return False


def decode_base64_url(encoded_url):
    """Decode base64 URL (supports both standard and URL-safe base64)"""
    try:
        if "-" in encoded_url or "_" in encoded_url:
            decoded = base64.urlsafe_b64decode(encoded_url + "=" * (4 - len(encoded_url) % 4))
        else:
            decoded = base64.b64decode(encoded_url + "=" * (4 - len(encoded_url) % 4))
        return decoded.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decode base64 URL: {str(e)}")


def encode_base64_url(url):
    """Encode URL to URL-safe base64"""
    return base64.urlsafe_b64encode(url.encode("utf-8")).decode("utf-8").rstrip("=")


load_filters()


@app.route("/check", methods=["GET", "POST"])
def check_url():
    ensure_filters_loaded()

    if request.method == "POST":
        data = request.get_json()
        url_input = data.get("url")
        source_url = data.get("source_url", "")
        request_type = data.get("type", "other")
    else:
        url_input = request.args.get("url")
        source_url = request.args.get("source_url", "")
        request_type = request.args.get("type", "other")

    if not url_input:
        return jsonify({"error": "URL is required"}), 400

    if is_base64(url_input):
        try:
            decoded_url = decode_base64_url(url_input)
            url_to_check = decoded_url
            was_base64 = True
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    else:
        url_to_check = url_input
        was_base64 = False

    if not url_to_check.startswith(("http://", "https://", "//")):
        url_to_check = "https://" + url_to_check

    encoded_url = encode_base64_url(url_to_check)

    result = engine.check_network_urls(
        url=url_to_check, source_url=source_url, request_type=request_type
    )

    response_data = {
        "original_input": url_input,
        "was_base64": was_base64,
        "url": url_to_check,
        "base64_url": encoded_url,
        "blocked": result.matched,
        "allowed": not result.matched,
    }

    if result.matched:
        response_data["filter"] = result.filter

    return jsonify(response_data)


@app.route("/check/<path:url_input>", methods=["GET"])
def check_url_path(url_input):
    """Check URL via path parameter"""
    ensure_filters_loaded()

    if is_base64(url_input):
        try:
            decoded_url = decode_base64_url(url_input)
            url_to_check = decoded_url
            was_base64 = True
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    else:
        url_to_check = url_input
        was_base64 = False

    if not url_to_check.startswith(("http://", "https://", "//")):
        url_to_check = "https://" + url_to_check

    encoded_url = encode_base64_url(url_to_check)

    result = engine.check_network_urls(url=url_to_check, source_url="", request_type="other")

    response_data = {
        "original_input": url_input,
        "was_base64": was_base64,
        "url": url_to_check,
        "base64_url": encoded_url,
        "blocked": result.matched,
        "allowed": not result.matched,
    }

    if result.matched:
        response_data["filter"] = result.filter

    return jsonify(response_data)


@app.route("/reload", methods=["POST"])
def reload_filters():
    """Manually reload filters"""
    try:
        load_filters()
        return jsonify({"status": "success", "message": "Filters reloaded"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/health")
def health():
    return jsonify(
        {"status": "ok", "filters_loaded": engine is not None, "last_update": last_update}
    )


if __name__ == "__main__":
    app.run(debug=False, port=5000)
