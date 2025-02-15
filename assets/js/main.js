const galaxy = document.getElementById('galaxy');
const NUM_STARS = 100;

for (let i = 0; i < NUM_STARS; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.top = Math.random() * 100 + '%';
    star.style.left = Math.random() * 100 + '%';
    star.style.animationDuration = (Math.random() * 2 + 1) + 's';
    const starSize = (Math.random() * 4) + 1;
    star.style.width = starSize + 'px';
    star.style.height = starSize + 'px';
    galaxy.appendChild(star);
}

const starLabels = [
    "2018 – Introduced NLP-driven sentiment analysis for US equities",
    "2019 – Expanded sentiment analysis to investment reports",
    "2020 – Added social media data for sentiment research",
    "2021 – Shifted from sentiment scoring to extract investable topics",
    "2022 – Developed more advanced language models",
    "2023 – Launched SentiMove for extracting actionable market insights",
    "2024 – Launched SentiChain for decentralized sentiment intelligence",
    "2025 – Transition to AI Agents to perform human-like investment research"
];
const timelineWrapper = document.getElementById('special-stars-wrapper');

starLabels.forEach(labelText => {
    const row = document.createElement('div');
    row.className = 'special-star-row';

    const star = document.createElement('div');
    star.className = 'special-star';

    const label = document.createElement('div');
    label.className = 'star-label';
    label.textContent = labelText;

    row.appendChild(star);
    row.appendChild(label);
    timelineWrapper.appendChild(row);
});

const s1 = document.getElementById('section1');
const s2 = document.getElementById('section2');
const s3 = document.getElementById('section3');
const s4 = document.getElementById('section4');

window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY;
    const screenHeight = window.innerHeight;

    if (scrollPos >= screenHeight) {
        const scrollNotification = document.getElementById('scroll-down-notification');
        if (scrollNotification) {
            scrollNotification.style.display = 'none';
        }
    }

    if (scrollPos < screenHeight) {
        s1.classList.remove('hidden');
        s2.classList.add('hidden');
        s3.classList.add('hidden');
        s4.classList.add('hidden');
        galaxy.style.transform = 'scale(1) rotateX(0deg)';
        galaxy.classList.remove('section3-active');
    } else if (scrollPos >= screenHeight && scrollPos < 2 * screenHeight) {
        s1.classList.add('hidden');
        s2.classList.remove('hidden');
        s3.classList.add('hidden');
        s4.classList.add('hidden');
        galaxy.style.transform = 'perspective(1000px) rotateX(20deg) scale(1.5)';
        galaxy.classList.remove('section3-active');
    } else if (scrollPos >= 2 * screenHeight && scrollPos < 3 * screenHeight) {
        s1.classList.add('hidden');
        s2.classList.add('hidden');
        s3.classList.remove('hidden');
        s4.classList.add('hidden');
        galaxy.style.transform = 'perspective(1000px) rotateX(10deg) scale(1.1)';
        galaxy.classList.add('section3-active');
    } else {
        s1.classList.add('hidden');
        s2.classList.add('hidden');
        s3.classList.add('hidden');
        s4.classList.remove('hidden');
        galaxy.style.transform = 'scale(1) rotateX(0deg)';
        galaxy.classList.remove('section3-active');
    }
});

setTimeout(() => {
    const scrollNotification = document.getElementById('scroll-down-notification');
    if (scrollNotification) {
        scrollNotification.style.display = 'none';
    }
}, 5000);
