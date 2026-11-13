function rejectStartup() {
    return Promise.resolve().then(() => {
        throw new Error("Content startup rejected");
    });
}

if (location.pathname === "/detached") void rejectStartup();
else if (location.pathname === "/returned") rejectStartup();
else setTimeout(rejectStartup, 0);
