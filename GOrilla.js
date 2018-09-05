function GOrilla(genes, species) {

    // ENRICHR
    // var description  = description || "";
    // var popup = true;
    // var form = document.createElement('form');
    // var listField = document.createElement('input');
    // var descField = document.createElement('input');
    // form.setAttribute('method', 'post');
    // form.setAttribute('action', 'http://amp.pharm.mssm.edu/Enrichr/enrich');
    // form.setAttribute('target', '_blank');
    // form.setAttribute('enctype', 'multipart/form-data');
    // listField.setAttribute('type', 'hidden');
    // listField.setAttribute('name', 'list');
    // listField.setAttribute('value', genes);
    // form.appendChild(listField);
    // descField.setAttribute('type', 'hidden');
    // descField.setAttribute('name', 'description');
    // descField.setAttribute('value', description);
    // form.appendChild(descField);

    // GOrilla
    var form = document.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action', 'http://cbl-gorilla.cs.technion.ac.il/servlet/GOrilla');
    form.setAttribute('target', '_blank');
    form.setAttribute('enctype', 'multipart/form-data');

    var application_field = document.createElement('input');
    application_field.setAttribute("type", "hidden");
    application_field.setAttribute("name", "application");
    application_field.setAttribute("value", "gorilla");
    form.appendChild(application_field);

    var species_field = document.createElement('input');
    species_field.setAttribute("type", "hidden");
    species_field.setAttribute("name", "species");
    species_field.setAttribute("value", species);
    form.appendChild(species_field);

    var run_mode_field = document.createElement('input');
    run_mode_field.setAttribute("type", "hidden");
    run_mode_field.setAttribute("name", "run_mode");
    run_mode_field.setAttribute("value", "mhg");
    form.appendChild(run_mode_field);

    var target_set_field = document.createElement('input');
    target_set_field.setAttribute("type", "hidden");
    target_set_field.setAttribute("name", "target_set");
    target_set_field.setAttribute("value", genes.join("\n"));
    form.appendChild(target_set_field);

    var background_set_field = document.createElement('input');
    background_set_field.setAttribute("type", "hidden");
    background_set_field.setAttribute("name", "background_set");
    background_set_field.setAttribute("value", "");
    form.appendChild(background_set_field);

    var db_field = document.createElement('input');
    db_field.setAttribute("type", "hidden");
    db_field.setAttribute("name", "db");
    db_field.setAttribute("value", "proc");
    form.appendChild(db_field);

    var run_gogo_button_field = document.createElement('input');
    run_gogo_button_field.setAttribute("type", "hidden");
    run_gogo_button_field.setAttribute("name", "run_gogo_button");
    run_gogo_button_field.setAttribute("value", "Search Enriched GO terms");
    form.appendChild(run_gogo_button_field);

    var pvalue_thresh_field = document.createElement('input');
    pvalue_thresh_field.setAttribute("type", "hidden");
    pvalue_thresh_field.setAttribute("name", "pvalue_thresh");
    pvalue_thresh_field.setAttribute("value", "0.001");
    form.appendChild(pvalue_thresh_field);

    var analysis_name_field = document.createElement('input');
    analysis_name_field.setAttribute("type", "hidden");
    analysis_name_field.setAttribute("name", "analysis_name");
    analysis_name_field.setAttribute("value", "");
    form.appendChild(analysis_name_field);

    var user_email_field = document.createElement('input');
    user_email_field.setAttribute("type", "hidden");
    user_email_field.setAttribute("name", "user_email");
    user_email_field.setAttribute("value", "");
    form.appendChild(user_email_field);

    var fast_mode_field = document.createElement('input');
    fast_mode_field.setAttribute("type", "hidden");
    fast_mode_field.setAttribute("name", "fast_mode");
    fast_mode_field.setAttribute("value", "on");
    form.appendChild(fast_mode_field);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}
