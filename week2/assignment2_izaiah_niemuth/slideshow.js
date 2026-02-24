const _s = Array.from(document.querySelectorAll(".slide"));
const _p = document.getElementById("_p");
const _n = document.getElementById("_n");
let _c = 0;

const _sh = (index) => {
    _s[_c].classList.remove("active");
    _c = (index + _s.length) % _s.length;
    _s[_c].classList.add("active");
};

if (_p && _n && _s.length > 0) {
    _p.addEventListener("click", () => _sh(_c - 1));
    _n.addEventListener("click", () => _sh(_c + 1));
}
