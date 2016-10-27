METHOD if_rest_resource~post.

  DATA:   lv_json_i     TYPE string,
          lv_json_o     TYPE string,
          lv_current_time TYPE timestamp,
          lv_guid TYPE zcp_guid,
          lo_entity   TYPE REF TO if_rest_entity.

  DATA: ls_params TYPE zaws1_stock_req,
        lt_result TYPE zaws1_stock_res_t.

  GET TIME STAMP FIELD lv_current_time.

  lv_json_i = io_entity->get_string_data( ).

  zcl_aws1_json_util=>json_to_data( EXPORTING iv_json = lv_json_i
                                           IMPORTING es_data = ls_params ).

  lt_result = _get_stock( ls_params ).

  lv_json_o = zcl_aws1_json_util=>data_to_json( lt_result ).

** Response

  mo_response->set_header_field( iv_name = 'Cache-Control' iv_value =  'no-cache, no-store, must-revalidate' ). "#EC NOTEXT
  mo_response->set_header_field(
    iv_name = 'ABAP-Execution-Time'                         "#EC NOTEXT
    iv_value = cl_rest_http_utils=>format_http_date( iv_timestamp = lv_current_time ) ).

  lo_entity = me->mo_response->create_entity( ).

  lo_entity->set_modification_date( iv_modification_date = lv_current_time ).
  lo_entity->set_content_type( iv_media_type = if_rest_media_type=>gc_appl_json ).
  lo_entity->set_content_language( sy-langu ).
  lo_entity->set_string_data( lv_json_o ).
  mo_response->set_status( cl_rest_status_code=>gc_success_ok ).

  COMMIT WORK.

ENDMETHOD.