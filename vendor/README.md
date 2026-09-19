# vendor/

기내에서 CDN 을 못 쓴다. 런타임 외부 의존을 없애려고 여기에 둔다.

| 파일 | 출처 | 판 | 라이선스 |
|---|---|---|---|
| `pdf.min.js` | cdnjs `ajax/libs/pdf.js/3.11.174/pdf.min.js` | 3.11.174 | Apache-2.0 (Mozilla Foundation) |
| `pdf.worker.min.js` | cdnjs `ajax/libs/pdf.js/3.11.174/pdf.worker.min.js` | 3.11.174 | Apache-2.0 (Mozilla Foundation) |

들여올 때 CDN 이 주던 것과 **같은 판**을 받았다. 동작이 바뀌면 안 되는 이동이다.

```
sha256  5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946  pdf.min.js
sha256  feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b  pdf.worker.min.js
```

판을 올릴 때는 **본체와 워커를 같이** 올린다. 둘의 판이 어긋나면 pdf.js 가 거부한다.
파일명 뒤 `?v=` 도 같이 올려야 기존 사용자가 새 사본을 받는다 — `index.html` ·
`desktop.html` · `sw.js` 의 `CORE` 세 군데다.
