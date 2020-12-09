$(window).scroll(function () {
    if ($(".index-header").offset().top > 50) {
        $(".index-header").addClass("after-scroll");
        $('#logo').attr('src', './images/new-black-logo.png');
    } else {
        $(".index-header").removeClass("after-scroll");
        $('#logo').attr('src', './images/new-white.png');
    }
});

/*$('#navDropdown').mouseenter(function(){
    $('#navDropdown').find('#navDropdownLinks').removeClass('hidden');
}).mouseleave(function(){
    $('#navDropdown').find('#navDropdownLinks').addClass('hidden');
});*/
