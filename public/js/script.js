$(window).scroll(function () {
    if ($(".index-header").offset().top > 50) {
        $(".index-header").addClass("after-scroll");
    } else {
        $(".index-header").removeClass("after-scroll");
    }
});


/*$('#navDropdown').mouseenter(function(){
    $('#navDropdown').find('#navDropdownLinks').removeClass('hidden');
}).mouseleave(function(){
    $('#navDropdown').find('#navDropdownLinks').addClass('hidden');
});*/