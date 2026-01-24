import test from "ava";

const xorRegex =
  /^(?:[a-zA-Z0-9-_.!~*'()]+%[0-9A-F]{2})*[a-zA-Z0-9-_.!~*'()]+$/;

const xor = {
  encode(str) {
    if (!str) return str;
    let result = "";
    for (let i = 0; i < str.length; i++) {
      result += i % 2 ? String.fromCharCode(str.charCodeAt(i) ^ 2) : str[i];
    }
    return encodeURIComponent(result);
  },
  decode(str) {
    if (!str) return str;
    const [input, ...search] = str.split("?");
    let result = "";
    const decoded = decodeURIComponent(input);
    for (let i = 0; i < decoded.length; i++) {
      result +=
        i % 2 ? String.fromCharCode(decoded.charCodeAt(i) ^ 2) : decoded[i];
    }
    return result + (search.length ? "?" + search.join("?") : "");
  },
};

test("proxies encode properly", t => {
  t.regex(xor.encode("https://www.google.com/search"), xorRegex);
});
