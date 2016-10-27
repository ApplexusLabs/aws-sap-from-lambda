METHOD if_rest_resource~get.
  DATA: lo_entity       TYPE REF TO if_rest_entity,
        lv_current_time TYPE timestamp.
  GET TIME STAMP FIELD lv_current_time.
  mo_response->set_header_field( iv_name = 'Cache-Control' iv_value =  'no-cache, no-store, must-revalidate' ). "#EC NOTEXT
  mo_response->set_header_field(
    iv_name = 'ABAP-Execution-Time'                         "#EC NOTEXT
    iv_value = cl_rest_http_utils=>format_http_date( iv_timestamp = lv_current_time ) ).
  mo_response->set_status( cl_rest_status_code=>gc_success_ok ).
ENDMETHOD.