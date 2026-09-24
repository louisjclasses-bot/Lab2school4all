//
function colorer_nombre(nm) {
	if(nm == "") return "";
	classe = ["unite","dizaine","centaine"];
	out = "";
	i=0;
	for(j=nm.length-1; j>=0; j--) {
		if(nm[j].match(/\d/)) {
			if(i<3) cl=classe[i]; else cl="milliers";
			out = '<span class="' + cl + '">'
			+ nm[j] + "<\/span>" + out;
			i++;
		} else {
			i=0;
			out = nm[j]+out;
		}
	}
	return out;
}
/*
	champs texte
*/
function champ_texte_get_pos(that) {
	// Safari n'a pas toujours une range vide par défaut
	var range_count = window.getSelection().rangeCount
	if(range_count > 0) {
		// récupération de la position du curseur dans le champ
		// (si il y est)
		var range = window.getSelection().getRangeAt(0);
		var TN = $(that).children().andSelf().textNodes();
		var TT=0;
		for(i=0; i<TN.length; i++) {
			if(TN[i] == range.startContainer) {
				break;
			}
			TT += TN[i].length;
		}
		return TT+range.startOffset;
	}
	return 0;
}
function champ_texte_set_pos(that,navant) {
	// récupération du nouveau node correspondant
	// à la position précédente du curseur
	var TN = $(that).children().andSelf().textNodes();
	var TT = 0;
	if(TN.length>0) {
		TT=0;
		for(i=0; i<TN.length; i++) {
			if(TT+TN[i].length>navant) {
				break;
			}
			TT += TN[i].length;
		}
		if(i==TN.length) { --i; TT=TT-TN[i].length; }
	} else {
		TT=navant;
		i=0;
		TN=[that];
	}
	// créer un nouveau range pour y positionner le curseur
	var nrange = document.createRange();
	try {
		nrange.setStart(TN[i],navant-TT);
		nrange.setEnd(TN[i],navant-TT);
	} catch(e) {
		nrange.setStart(TN[i],TN[i].length);
		nrange.setEnd(TN[i],TN[i].length);
	}
	//
	window.getSelection().addRange(nrange);
}
function champ_texte_update(that,e) {
	var content = $(that).html().replace(/<[^><]+>/g,"");
	if(content == "") content = ' ';
	var len = content.length;
	content = colorer_nombre(content);
	//
	var navant = champ_texte_get_pos(that);
	//
	$(that).html(content);
	window.getSelection().removeAllRanges();
	//
	champ_texte_set_pos(that,navant);
	//
	montre_exos(content.replace(/[^0-9]/g,"").replace(/^0+/,''));
}

$(function() {
	/*
		champs texte
	*/
	$(".champ").keyup(function(event){
		return champ_texte_update(this,event);
	});
	/*
		clavier numérique
		si il n'y en a qu'un dans la page courante ("montrer")
		-> sélectionner de force celui-là
	*/
	var recherche = $('#recherche');
	$('.clavier_num_div .num').bind("click",function(e){
		var content = recherche.html().replace(/<[^><]+>/g,"")+$(this).val();
		recherche.html(content);
		champ_texte_update(recherche[0],0);
		recherche.focus();
		stopPropa(e);
		return false;
	});
	$('.clavier_num_div .del').bind("click",function(e){
		recherche.html("");
		champ_texte_update(recherche[0],0);
		recherche.focus();
		stopPropa(e);
		return false;
	});
	/*
		défilement
	*/
	$('#bleft').live("click",function() {
		var cible = $('.bloc_contenu');
		cible.queue(function() {
			var left = cible.scrollLeft();
			left = Math.max(0,left-cible.width()/2);
			cible.animate({scrollLeft: left},'fast');
			$(this).dequeue();
		});
	});
	$('#bright').live("click",function() {
		var cible = $('.bloc_contenu');
		cible.queue(function() {
			var left = cible.scrollLeft();
			if(left+ cible.width() < cible.attr('scrollWidth')) {
				left = Math.max(0,left+cible.width()/2);
				cible.animate({scrollLeft: left},'fast');
			}
			$(this).dequeue();
		});
	});
});

function montre_exos(numero_page) {
	if($('.bloc_exos_page_num'+numero_page).length == 1) {
		$('.error').html("");
 		if($('.table_pages:visible').length) {
			$('.bloc_contenu').data('scrollLeft',
 				$('.bloc_contenu').scrollLeft()
 			);
 		}
		$('.table_pages:visible,.bloc_exos_page:visible').not('.bloc_exos_page_num'+numero_page).animate({ top:"-500px" }, 500, function(){
			$(this).hide();
		});
		$('.bloc_exos_page_num'+numero_page).not(':visible').css({ top: "500px" }).show().animate({ top:"0px" },500);
	} else {
		revenir_page();
		if(numero_page != "") $('.error').html("Il n'y a pas de page "+numero_page);
	}
	return false;
}
function revenir_page() {
	$('.bloc_exos_page:visible').animate({ top:"500px" }, 500, function() {
		$(this).hide();
	});
	$('.table_pages').css({ top:"-500px" }).show().animate({ top:"0px" }, 500, function(){
		$('.bloc_contenu').scrollLeft(
			$('.bloc_contenu').data('scrollLeft')
		);
	});
	return false;
}
//
function target_blank_check(that,event) {
	if($(that).attr('checked')) {
		$('a.be').each(function(){
			$(this).attr('target','_blank');
		});
	} else {
		$('a.be').each(function(){
			$(this).attr('target','_self');
		});
	}
}