// Functions
function changePage(num) {
    // Set indexes
    var currentSlideIndex = parseInt(document.getElementById("page").innerHTML);
    var newSlideIndex = currentSlideIndex + num;
    var totalSlides = parseInt(document.getElementById("pages").innerHTML);

    // Set defaults if index supplied is out of range
    if (newSlideIndex > totalSlides) {newSlideIndex = 1}
    if (newSlideIndex < 1) {newSlideIndex = totalSlides} ;

    // Update 
    document.getElementById("gotopageno").innerHTML = newSlideIndex; // update page index
    document.getElementById("page").innerHTML = newSlideIndex; // update page index
    updateDivs(newSlideIndex);
}
function gotopageno(num) {
    var idx = updateDivs(num);
    document.getElementById('gotopageno').value = idx;
}
function updateDivs(slideIndex) {
    // Initialize index and total slides
    var slides = document.getElementsByClassName("mySlides");
    if (slides.length > 0) {
        // Hide all slides
        for (var i = 0; i < slides.length; i++) {
            slides[i].style.display = "none";
        }

        // Set defaults if index supplied is out of range
        var idx = slideIndex;
        if (slideIndex > slides.length) {idx = slides.length}
        if (slideIndex < 1) {idx = 1} ;

        // Show slide of choice (-1 to account for 0 being the first index in array)
        slides[idx-1].style.display = "block";

        return idx;
    }

    
}
function goBack() {
    changePage(-1);
}
function goNext() {
    changePage(1);
}

// On Page Load
(function () {
    // Top Navigation Init
    var slideIndex = 1
    var total_pages = document.getElementsByClassName("mySlides").length;
    if (document.getElementById("page")) {
        document.getElementById("page").innerHTML = slideIndex;
    }
    if (document.getElementById("pages")) {
        document.getElementById("pages").innerHTML = total_pages;
    }

    // Display Divs
    updateDivs(slideIndex);
})();
