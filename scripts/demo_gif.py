"""Gera docs/demo.gif e docs/capa.png (1200x750) da demo online, headless."""
import io, sys
from PIL import Image
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787/"
frames = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.on("dialog", lambda d: d.accept())
    pg.goto(URL); pg.wait_for_timeout(1500)
    g, c = pg.frame_locator("iframe").first, pg.frame_locator("iframe").last
    g.get_by_role("button", name="Zerar o dia").click(); pg.wait_for_timeout(600)
    def snap(ms=700, n=1):
        pg.wait_for_timeout(ms); pg.evaluate("scrollTo(0,0)")
        for _ in range(n): frames.append(Image.open(io.BytesIO(pg.screenshot())).convert("RGB"))
    snap(300, 2)
    for mesa, itens in [("7", ["X-Brasa", "Batata Rústica", "Limonada Suíça"]), ("12", ["Pastel de Feira", "Suco de Laranja"])]:
        g.locator("#mesa").fill(mesa); snap(200)
        for i in itens: g.get_by_role("button", name=i).click(); snap(250)
        g.get_by_role("button", name="Enviar à cozinha").click(); snap(500, 2)
    c.get_by_role("button", name="Iniciar preparo").first.click(); snap(600, 2)
    c.get_by_role("button", name="Marcar pronto").first.click(); snap(1500, 3)
    pg.screenshot(path=sys.argv[2] if len(sys.argv) > 2 else "/c/SISTEMA/jobs/S-1568/full.png")
    b.close()
w, h = 1000, 625
small = [f.resize((w, h)) for f in frames]
small[0].save("docs/demo.gif", save_all=True, append_images=small[1:], duration=700, loop=0, optimize=True)
frames[-1].crop((0, 0, 1280, 800)).resize((1200, 750)).save("docs/capa.png")
print(len(frames), "frames")
