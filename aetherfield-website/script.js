document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Load Animations
    setTimeout(() => {
        const loadElements = document.querySelectorAll('.animate-onload');
        loadElements.forEach(el => el.classList.add('is-visible'));
    }, 100);

    // 2. Scroll Fade-in Animations (Intersection Observer)
    const scrollObserverOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                
                // Trigger counter animation if it's a metric card with a counter
                if (entry.target.classList.contains('metric-card')) {
                    const counter = entry.target.querySelector('.counter');
                    if (counter && !counter.classList.contains('counted')) {
                        animateCounter(counter);
                        counter.classList.add('counted');
                    }
                }
                
                // Stop observing once animated
                observer.unobserve(entry.target);
            }
        });
    }, scrollObserverOptions);

    const scrollElements = document.querySelectorAll('.animate-on-scroll');
    scrollElements.forEach(el => scrollObserver.observe(el));

    // 3. Navbar Sticky & Blur Effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 4. Counter Animation
    function animateCounter(element) {
        const target = parseFloat(element.getAttribute('data-target'));
        const duration = 2000; // ms
        const steps = 60;
        const stepTime = duration / steps;
        
        let current = 0;
        const increment = target / steps;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            element.textContent = Math.round(current);
        }, stepTime);
    }
});
